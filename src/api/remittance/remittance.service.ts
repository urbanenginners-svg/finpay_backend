import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  NON_RELATIVE_GIFT_MAX_USD,
  NON_RELATIVE_GIFT_PURPOSE_CODE,
  PrithviExchangeService,
  PrithviForexApiService,
  PrithviForexRequestStatus,
  PrithviOrderType,
  PrithviProductType,
  extractPrithviRate,
} from 'src/services/prithvi-exchange';
import { AgentCardRateService } from 'src/services/agent-card-rate/agent-card-rate.service';
import { CustomerCardRateService } from 'src/services/customer-card-rate/customer-card-rate.service';
import { CardRateConfigService } from 'src/services/card-rate-config/card-rate-config.service';
import { PrithviForexOrderService } from 'src/services/prithvi-exchange/prithvi-forex-order.service';
import { ForexOrderNotificationService } from 'src/services/prithvi-exchange/forex-order-notification.service';
import { User, UserDocument } from 'src/services/mongoose/schemas/user.schema';
import { ForexBookingSourceEnum } from 'src/utils/enums/forex-booking-source.enum';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';
import { FileResourceEnum } from 'src/utils/enums/file-resource.enum';
import { FilesService } from 'src/api/files/files.service';
import { AgentCustomerService } from 'src/api/agent-customer/agent-customer.service';
import {
  applyLiveTtToCardRates,
  computeOrderCommissions,
  resolveFinpayCommission,
  roundMoney,
  toFiniteNumber,
  validateCustomerSellRate,
  type CardRateCalcOptions,
} from 'src/utils/agent-commission.util';
import { isForexOrderPayable } from 'src/utils/forex-payment.util';
import {
  CompleteForexRequestDto,
  CompleteForexOrderDto,
  CheckLrsDto,
  ForexOrderDetailDto,
  GetAgentChargesQueryDto,
  GetForexOrdersDashboardQueryDto,
  GetPurposesQueryDto,
  GetRemittanceRatesQueryDto,
  InitiateForexRequestDto,
  ProviderTokenStatusQueryDto,
} from './dto';
import { PrithviLeadSystemService } from 'src/services/prithvi-lead-system';

export type GetAdminForexOrdersQuery = GetForexOrdersDashboardQueryDto & {
  createdByUserId?: string;
  bookingSource?: ForexBookingSourceEnum | string;
  q?: string;
};

@Injectable()
export class RemittanceService {
  private readonly logger = new Logger(RemittanceService.name);

  constructor(
    private readonly prithviService: PrithviExchangeService,
    private readonly prithviForex: PrithviForexApiService,
    private readonly prithviLeadSystem: PrithviLeadSystemService,
    private readonly forexOrders: PrithviForexOrderService,
    private readonly forexOrderNotifications: ForexOrderNotificationService,
    private readonly filesService: FilesService,
    private readonly agentCardRates: AgentCardRateService,
    private readonly customerCardRates: CustomerCardRateService,
    private readonly cardRateConfig: CardRateConfigService,
    private readonly agentCustomers: AgentCustomerService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  getProviders() {
    return [
      {
        id: RemittanceProvider.PRITHVI,
        name: 'Prithvi Exchange',
        active: this.prithviService.isActive,
      },
    ];
  }

  async getRates(query: GetRemittanceRatesQueryDto) {
    const rates = await this.prithviService.getAgentRates({
      orderType: query.orderType,
      productType: query.productType,
      agentId: query.agentId,
    });

    const currencies = rates.currencies.map((entry) => ({
      currencyCode: entry.currencyCode,
      currencyName: entry.currencyName,
      rate: extractPrithviRate(entry, query.orderType, query.productType),
      gstPercentage: entry.gstPercentage,
      timestamp: entry.timestamp,
      rates: entry.rates,
    }));

    return {
      provider: RemittanceProvider.PRITHVI,
      orderType: query.orderType,
      productType: query.productType,
      message: rates.message,
      source: rates.source,
      timestamp: rates.timestamp,
      fetchedAt: rates.fetchedAt,
      fromCache: rates.fromCache,
      currencies,
    };
  }

  async getCharges(query: GetAgentChargesQueryDto) {
    const totalLrsAmount =
      typeof query.totalLrsAmount === 'number' &&
      Number.isFinite(query.totalLrsAmount) &&
      query.totalLrsAmount > 0
        ? query.totalLrsAmount
        : query.inrAmount;
    return this.prithviForex.getAgentCharges({
      orderType: query.orderType,
      productType: query.productType,
      currencyCode: query.currencyCode,
      currencyAmount: query.currencyAmount,
      inrAmount: query.inrAmount,
      totalLrsAmount,
      purposeCode: query.purposeCode,
    });
  }

  async checkLrs(dto: CheckLrsDto) {
    return this.prithviLeadSystem.checkLrs({ pan: dto.pan });
  }

  async initiateForex(dto: InitiateForexRequestDto, userId: string) {
    await this.assertNonRelativeGiftLimit(dto);
    const bookingSource = await this.resolveBookingSource(userId);
    const orderDetails = await Promise.all(
      dto.orderDetails.map(async (order) => {
        // Normalize sell rates first so provider charges use X (customer) / Z (agent).
        const normalized =
          bookingSource === ForexBookingSourceEnum.AGENT
            ? await this.normalizeAgentOrderRates(
                String(userId),
                order,
                dto.purposeCode,
              )
            : await this.normalizeCustomerOrderRates(order, dto.purposeCode);
        return this.overlayInitiateCharges(
          dto.orderType,
          normalized,
          dto.purposeCode,
        );
      }),
    );
    const payload: InitiateForexRequestDto = { ...dto, orderDetails };

    const data = await this.prithviForex.initiateForexRequest({
      orderType: payload.orderType,
      orderDetails: payload.orderDetails.map((order) => {
        const {
          customerSellRate: _customerSellRate,
          totalLrsAmount: _totalLrsAmount,
          ...prithviDetail
        } = order;
        void _customerSellRate;
        void _totalLrsAmount;
        return prithviDetail;
      }),
    });

    await this.persistInitiateOrders(String(userId), payload, data, bookingSource);

    return data;
  }

  private async assertNonRelativeGiftLimit(dto: InitiateForexRequestDto) {
    const purposeCode = String(dto.purposeCode ?? '')
      .trim()
      .toUpperCase();
    if (purposeCode !== NON_RELATIVE_GIFT_PURPOSE_CODE) return;

    const limitLabel = `USD ${NON_RELATIVE_GIFT_MAX_USD.toLocaleString('en-US')}`;
    let liveRates: Map<string, number> | null = null;

    for (const order of dto.orderDetails) {
      const currency = String(order.currency ?? '')
        .trim()
        .toUpperCase();
      const amount = toFiniteNumber(order.currencyAmount);
      if (!currency || !(amount > 0)) continue;

      let usdAmount = amount;
      if (currency !== 'USD') {
        liveRates ??= await this.getLiveTtBuyRatesByCurrency();
        const fromRate = liveRates.get(currency) ?? 0;
        const usdRate = liveRates.get('USD') ?? 0;
        if (!(fromRate > 0) || !(usdRate > 0)) {
          throw new BadRequestException(
            `Unable to verify the ${limitLabel} limit for Non-Relative Gift transfers because the ${currency}/USD rate is unavailable. Please try again shortly.`,
          );
        }
        usdAmount = (amount * fromRate) / usdRate;
      }

      if (roundMoney(usdAmount) > NON_RELATIVE_GIFT_MAX_USD) {
        throw new BadRequestException(
          `Non-Relative Gift transfers are limited to ${limitLabel} equivalent per transaction. ${amount} ${currency} is approx. USD ${roundMoney(usdAmount).toFixed(2)}.`,
        );
      }
    }
  }

  async completeForex(
    id: string,
    dto: CompleteForexRequestDto,
    userId: string,
  ) {
    if (!id?.trim()) {
      throw new BadRequestException('Forex request id is required');
    }

    const forexRequestId = id.trim();
    const bookingSource = await this.resolveBookingSource(userId);

    if (bookingSource === ForexBookingSourceEnum.AGENT) {
      const missingRemitter = dto.orders.some((order) => !order.remitterDetails);
      if (missingRemitter) {
        throw new BadRequestException(
          'Customer remitter details are required when an agent books for a walk-in customer.',
        );
      }

      for (const order of dto.orders) {
        const customerId = order.agentCustomerId?.trim();
        if (!customerId) {
          throw new BadRequestException(
            'Select an agent customer before completing the booking.',
          );
        }
        await this.agentCustomers.findOwned(String(userId), customerId);
      }
    }

    const data = await this.prithviForex.completeForexRequest({
      forexRequestId,
      orders: dto.orders,
    });

    await this.persistCompleteOrders(
      String(userId),
      forexRequestId,
      dto,
      data,
      bookingSource,
    );

    return data;
  }

  /**
   * Generate a payment link for a forex order the user owns.
   * Proxies to Prithvi POST /orders/:orderId/payment-link with redirectUrl.
   */
  async createPaymentLink(orderId: string, userId: string) {
    const trimmedOrderId = orderId?.trim();
    if (!trimmedOrderId) {
      throw new BadRequestException('Order id is required');
    }

    const owned = await this.forexOrders.findOwnedByUser(
      trimmedOrderId,
      String(userId),
    );
    if (!owned) {
      throw new NotFoundException('Forex order not found for this account');
    }

    this.assertOrderPayable(
      {
        status: owned.status,
        paymentStatus: owned.paymentStatus,
        bookingSource:
          owned.bookingSource ?? (await this.resolveBookingSource(userId)),
        offlinePayment: owned.offlinePayment,
        offlineUtrNumber: owned.offlineUtrNumber,
      },
      'online',
    );

    return this.prithviForex.createPaymentLink({ orderId: trimmedOrderId });
  }

  /**
   * Submit offline bank transfer: store receipt in Finpay S3, register with Prithvi,
   * then upload payment receipt to Prithvi.
   */
  async submitOfflinePayment(
    orderId: string,
    paymentMode: string,
    utrNumber: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    const trimmedOrderId = orderId?.trim();
    if (!trimmedOrderId) {
      throw new BadRequestException('Order id is required');
    }

    const normalizedMode = paymentMode?.trim().toUpperCase();
    const trimmedUtr = utrNumber?.trim();
    if (!normalizedMode || !['IMPS', 'NEFT', 'RTGS'].includes(normalizedMode)) {
      throw new BadRequestException('paymentMode must be IMPS, NEFT, or RTGS');
    }
    if (!trimmedUtr) {
      throw new BadRequestException('UTR number is required');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Payment statement receipt is required');
    }

    const owned = await this.forexOrders.findOwnedByUser(
      trimmedOrderId,
      String(userId),
    );
    if (!owned) {
      throw new NotFoundException('Forex order not found for this account');
    }

    this.assertOrderPayable(
      {
        status: owned.status,
        paymentStatus: owned.paymentStatus,
        bookingSource:
          owned.bookingSource ?? (await this.resolveBookingSource(userId)),
        offlinePayment: owned.offlinePayment,
        offlineUtrNumber: owned.offlineUtrNumber,
      },
      'offline',
    );

    let localFileId: string | null = null;
    try {
      const localFile = await this.filesService.uploadSingle(
        file,
        {
          type: FileResourceEnum.DOCUMENT,
          referenceId: `${trimmedOrderId}:payment-receipt`,
        },
        String(userId),
      );
      localFileId = String(localFile._id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to store payment receipt in Finpay S3: ${detail}`,
      );
      throw new InternalServerErrorException(
        'Unable to store payment receipt. Please try again.',
      );
    }

    await this.prithviForex.setOrderOfflinePayment({
      orderId: trimmedOrderId,
      paymentMode: normalizedMode,
      utrNumber: trimmedUtr,
    });

    const receiptResult = await this.prithviForex.uploadPaymentReceipt({
      orderId: trimmedOrderId,
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
    });

    const prithviKey =
      receiptResult.paymentDetails?.paymentStatementReceipt ??
      receiptResult.s3Key;

    await this.forexOrders.applyOfflinePayment({
      prithviOrderId: trimmedOrderId,
      offlinePaymentMode: normalizedMode,
      offlineUtrNumber: trimmedUtr,
      paymentStatementReceiptLocalFileId: localFileId!,
      paymentStatementReceiptPrithviKey: prithviKey,
      paymentStatementReceiptUrl: receiptResult.receiptUrl ?? null,
    });

    return {
      id: trimmedOrderId,
      offlinePayment: true,
      offlinePaymentMode: normalizedMode,
      offlineUtrNumber: trimmedUtr,
      paymentStatementReceiptLocalFileId: localFileId,
      paymentStatementReceiptPrithviKey: prithviKey,
      paymentStatementReceiptUrl: receiptResult.receiptUrl ?? null,
    };
  }

  /**
   * Upload a purpose document to Finpay S3 and Prithvi order upload-document.
   * Returns the Prithvi storage path that must be sent on complete.
   */
  async uploadForexOrderDocument(
    orderId: string,
    documentType: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    if (!orderId?.trim()) {
      throw new BadRequestException('Order id is required');
    }
    if (!documentType?.trim()) {
      throw new BadRequestException('documentType is required');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Document file is required');
    }

    const owned = await this.forexOrders.findOwnedByUser(
      orderId.trim(),
      String(userId),
    );
    if (!owned) {
      throw new NotFoundException('Forex order not found for this account');
    }

    let localFileId: string | null = null;
    try {
      const localFile = await this.filesService.uploadSingle(
        file,
        {
          type: FileResourceEnum.DOCUMENT,
          referenceId: orderId.trim(),
        },
        String(userId),
      );
      localFileId = String(localFile._id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to store forex document in Finpay S3: ${detail}`,
      );
      throw new InternalServerErrorException(
        'Unable to store document in Finpay storage. Please try again.',
      );
    }

    const prithviResult = await this.prithviForex.uploadOrderDocument({
      orderId: orderId.trim(),
      documentType: documentType.trim(),
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
    });

    await this.forexOrders.setUploadedDocument({
      prithviOrderId: orderId.trim(),
      documentType: documentType.trim(),
      prithviPath: prithviResult.prithviPath,
      localFileId,
    });

    return {
      documentType: prithviResult.documentType,
      prithviPath: prithviResult.prithviPath,
      localFileId,
      fileName: file.originalname,
      forexOrder: prithviResult.forexOrder,
    };
  }

  /**
   * "My Documents" tab: every purpose document stored for this account.
   * Finpay users see their self-bookings; agents see their walk-in customers'
   * documents (all customers, or one when agentCustomerId is passed).
   */
  async listForexDocuments(userId: string, agentCustomerId?: string) {
    const bookingSource = await this.resolveBookingSource(userId);
    let scope: string | null | 'any' = null;
    if (bookingSource === ForexBookingSourceEnum.AGENT) {
      const customerId = agentCustomerId?.trim();
      if (customerId) {
        await this.agentCustomers.findOwned(String(userId), customerId);
        scope = customerId;
      } else {
        scope = 'any';
      }
    } else if (agentCustomerId?.trim()) {
      throw new BadRequestException(
        'agentCustomerId is only valid for agent accounts',
      );
    }

    const orders = await this.forexOrders.findOrdersWithDocuments({
      createdByUserId: String(userId),
      agentCustomerId: scope,
      limit: 300,
    });

    type DocumentEntry = {
      localFileId: string;
      documentType: string;
      agentCustomerId: string | null;
      orders: Array<{
        orderId: string;
        orderCode: string | null;
        status: string | null;
        statusLabel: string | null;
        purpose: string | null;
      }>;
    };
    const byFileId = new Map<string, DocumentEntry>();

    for (const order of orders) {
      for (const [documentType, rawFileId] of Object.entries(
        order.localDocumentFileIds ?? {},
      )) {
        if (!rawFileId) continue;
        const localFileId = String(rawFileId);
        let entry = byFileId.get(localFileId);
        if (!entry) {
          entry = {
            localFileId,
            documentType,
            agentCustomerId: order.agentCustomerId ?? null,
            orders: [],
          };
          byFileId.set(localFileId, entry);
        }
        if (!entry.orders.some((o) => o.orderId === order.prithviOrderId)) {
          entry.orders.push({
            orderId: order.prithviOrderId,
            orderCode: order.orderCode ?? null,
            status: order.status ?? null,
            statusLabel: order.statusLabel ?? null,
            purpose: order.purpose ?? null,
          });
        }
      }
    }

    const files = await this.filesService.findActiveByIds([...byFileId.keys()]);
    const fileById = new Map(files.map((f) => [String(f._id), f]));

    return [...byFileId.values()]
      .filter((entry) => fileById.has(entry.localFileId))
      .map((entry) => {
        const file = fileById.get(entry.localFileId)!;
        const createdAt = (file as unknown as { createdAt?: Date }).createdAt;
        return {
          ...entry,
          fileName: file.originalName ?? 'Document',
          mimeType: file.mimeType ?? null,
          size: file.size ?? null,
          uploadedAt: createdAt ? new Date(createdAt).toISOString() : null,
        };
      })
      .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));
  }

  /**
   * Purpose documents uploaded on earlier orders, so the booking UI can offer
   * "use previously uploaded" instead of a fresh upload.
   * Agents must scope to one of their walk-in customers.
   */
  async listReusableForexDocuments(
    userId: string,
    agentCustomerId?: string,
  ) {
    const bookingSource = await this.resolveBookingSource(userId);
    let customerId: string | null = null;
    if (bookingSource === ForexBookingSourceEnum.AGENT) {
      customerId = agentCustomerId?.trim() || null;
      if (!customerId) {
        throw new BadRequestException(
          'agentCustomerId is required to list documents for an agent customer',
        );
      }
      await this.agentCustomers.findOwned(String(userId), customerId);
    } else if (agentCustomerId?.trim()) {
      throw new BadRequestException(
        'agentCustomerId is only valid for agent accounts',
      );
    }

    const orders = await this.forexOrders.findOrdersWithDocuments({
      createdByUserId: String(userId),
      agentCustomerId: customerId,
    });

    const MAX_PER_TYPE = 3;
    const seen = new Set<string>();
    const perType = new Map<string, number>();
    const entries: Array<{
      documentType: string;
      localFileId: string;
      sourceOrderId: string;
      orderCode: string | null;
      uploadedAt: string | null;
    }> = [];

    for (const order of orders) {
      for (const [documentType, localFileId] of Object.entries(
        order.localDocumentFileIds ?? {},
      )) {
        if (!localFileId) continue;
        const key = `${documentType}:${localFileId}`;
        if (seen.has(key)) continue;
        const count = perType.get(documentType) ?? 0;
        if (count >= MAX_PER_TYPE) continue;
        seen.add(key);
        perType.set(documentType, count + 1);
        entries.push({
          documentType,
          localFileId: String(localFileId),
          sourceOrderId: order.prithviOrderId,
          orderCode: order.orderCode ?? null,
          uploadedAt: order.updatedAt
            ? new Date(order.updatedAt).toISOString()
            : null,
        });
      }
    }

    const files = await this.filesService.findActiveByIds([
      ...new Set(entries.map((e) => e.localFileId)),
    ]);
    const fileById = new Map(files.map((f) => [String(f._id), f]));

    return entries
      .filter((e) => fileById.has(e.localFileId))
      .map((e) => ({
        ...e,
        fileName: fileById.get(e.localFileId)?.originalName ?? 'Document',
      }));
  }

  /**
   * Attach a document stored on an earlier order to this order: re-sends the
   * Finpay S3 copy to Prithvi upload-document for the new order id.
   */
  async reuseForexOrderDocument(
    orderId: string,
    documentType: string,
    localFileId: string,
    userId: string,
  ) {
    const trimmedOrderId = orderId?.trim();
    const trimmedType = documentType?.trim();
    const trimmedFileId = localFileId?.trim();
    if (!trimmedOrderId) {
      throw new BadRequestException('Order id is required');
    }
    if (!trimmedType || !trimmedFileId) {
      throw new BadRequestException('documentType and localFileId are required');
    }

    const owned = await this.forexOrders.findOwnedByUser(
      trimmedOrderId,
      String(userId),
    );
    if (!owned) {
      throw new NotFoundException('Forex order not found for this account');
    }

    const ownsFile = await this.forexOrders.userOwnsDocumentFile({
      createdByUserId: String(userId),
      documentType: trimmedType,
      localFileId: trimmedFileId,
    });
    if (!ownsFile) {
      throw new NotFoundException(
        'Previously uploaded document not found for this account',
      );
    }

    const stored = await this.filesService.downloadFile(trimmedFileId);

    const prithviResult = await this.prithviForex.uploadOrderDocument({
      orderId: trimmedOrderId,
      documentType: trimmedType,
      buffer: stored.buffer,
      filename: stored.originalName,
      mimeType: stored.mimeType,
    });

    await this.forexOrders.setUploadedDocument({
      prithviOrderId: trimmedOrderId,
      documentType: trimmedType,
      prithviPath: prithviResult.prithviPath,
      localFileId: trimmedFileId,
    });

    return {
      documentType: prithviResult.documentType,
      prithviPath: prithviResult.prithviPath,
      localFileId: trimmedFileId,
      fileName: stored.originalName,
      forexOrder: prithviResult.forexOrder,
    };
  }

  /**
   * Serve forex orders from local MongoDB (booked via Finpay + 30-minute sync).
   * Scoped to the authenticated user — never the full Prithvi agent dashboard.
   */
  async getForexOrdersDashboard(
    query: GetForexOrdersDashboardQueryDto,
    userId: string,
  ) {
    return this.forexOrders.findDashboardForUser({
      createdByUserId: String(userId),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      status: query.status,
      product: query.product,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });
  }

  /**
   * Admin: all Finpay-booked forex orders across users, with owner profile.
   */
  async getAdminForexOrdersDashboard(query: GetAdminForexOrdersQuery) {
    const result = await this.forexOrders.findAllForAdmin({
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      status: query.status,
      product: query.product,
      fromDate: query.fromDate,
      toDate: query.toDate,
      createdByUserId: query.createdByUserId,
      bookingSource: query.bookingSource,
      q: query.q,
    });

    const userIds = [
      ...new Set(result.data.map((row) => row.createdByUserId).filter(Boolean)),
    ];
    const users = userIds.length
      ? await this.userModel
          .find({ _id: { $in: userIds } })
          .select('_id firstName lastName email phoneNumber userType')
          .lean()
          .exec()
      : [];

    const userById = new Map(
      users.map((user) => [
        String(user._id),
        {
          id: String(user._id),
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          userType: user.userType ?? null,
          displayName:
            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
            user.email ||
            String(user._id),
        },
      ]),
    );

    return {
      data: result.data.map((row) => ({
        ...row,
        user: userById.get(row.createdByUserId) ?? {
          id: row.createdByUserId,
          firstName: '',
          lastName: '',
          email: null,
          phoneNumber: null,
          userType: null,
          displayName: row.createdByUserId,
        },
      })),
      meta: result.meta,
    };
  }

  async getAdminForexOrdersStats(query: GetAdminForexOrdersQuery) {
    return this.forexOrders.getAdminStats({
      status: query.status,
      product: query.product,
      fromDate: query.fromDate,
      toDate: query.toDate,
      createdByUserId: query.createdByUserId,
      bookingSource: query.bookingSource,
      q: query.q,
    });
  }

  /** User: full detail for a single owned forex order. */
  async getForexOrderDetail(orderId: string, userId: string) {
    const trimmedOrderId = orderId?.trim();
    if (!trimmedOrderId) {
      throw new BadRequestException('Order id is required');
    }

    const detail = await this.forexOrders.findDetailForUser(
      trimmedOrderId,
      String(userId),
    );
    if (!detail) {
      throw new NotFoundException('Forex order not found for this account');
    }

    return detail;
  }

  /** Admin: full detail for a single forex order with booking owner profile. */
  async getAdminForexOrderDetail(orderId: string) {
    const trimmedOrderId = orderId?.trim();
    if (!trimmedOrderId) {
      throw new BadRequestException('Order id is required');
    }

    const detail = await this.forexOrders.findDetailForAdmin(trimmedOrderId);
    if (!detail) {
      throw new NotFoundException('Forex order not found');
    }

    const userId = detail.createdByUserId;
    const user = userId
      ? await this.userModel
          .findById(userId)
          .select('_id firstName lastName email phoneNumber userType')
          .lean()
          .exec()
      : null;

    const userProfile = user
      ? {
          id: String(user._id),
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          userType: user.userType ?? null,
          displayName:
            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
            user.email ||
            String(user._id),
        }
      : userId
        ? {
            id: userId,
            firstName: '',
            lastName: '',
            email: null,
            phoneNumber: null,
            userType: null,
            displayName: userId,
          }
        : null;

    return {
      ...detail,
      user: userProfile,
    };
  }

  /** Admin: manually pull latest order status from the provider. */
  async syncForexOrdersNow() {
    return this.prithviForex.syncOrdersFromProvider();
  }

  /**
   * Admin: set local forex order status so payment can be unlocked without
   * waiting for the provider sync. Sends the same email/SMS as a status sync.
   */
  async updateForexOrderStatus(orderId: string, status: PrithviForexRequestStatus) {
    const trimmedOrderId = orderId?.trim();
    if (!trimmedOrderId) {
      throw new BadRequestException('Order id is required');
    }

    const statusLabels: Record<PrithviForexRequestStatus, string> = {
      [PrithviForexRequestStatus.DRAFT]: 'Draft',
      [PrithviForexRequestStatus.PENDING]: 'Pending Approval',
      [PrithviForexRequestStatus.APPROVED]: 'Approved',
      [PrithviForexRequestStatus.DOCUMENTS_APPROVED_AWAITING_FUNDS]:
        'Documents Approved — Awaiting Funds',
      [PrithviForexRequestStatus.CANCELLED]: 'Cancelled',
    };

    const result = await this.forexOrders.applyLocalStatus({
      prithviOrderId: trimmedOrderId,
      status,
      statusLabel: statusLabels[status],
    });

    if (!result.matched) {
      throw new NotFoundException('Forex order not found');
    }

    if (result.statusChanged && result.createdByUserId) {
      await this.forexOrderNotifications.notifyIfStatusChanged({
        createdByUserId: result.createdByUserId,
        previousStatus: result.previousStatus ?? '',
        newStatus: result.newStatus ?? '',
        statusLabel: result.statusLabel,
        orderCode: result.orderCode,
        prithviOrderId: result.prithviOrderId,
      });
    }

    return {
      id: result.prithviOrderId,
      previousStatus: result.previousStatus,
      status: result.newStatus,
      statusLabel: result.statusLabel,
      statusChanged: result.statusChanged,
    };
  }

  /** Admin: manually fetch latest agent FX rates from Prithvi and update the cache. */
  async syncRatesNow(agentId?: string) {
    const rates = await this.prithviService.syncAgentRatesFromProvider(agentId);
    return {
      agentId: agentId ?? this.prithviService.getConfiguredAgentId(),
      currencyCount: rates.currencies.length,
      timestamp: rates.timestamp,
      isDryRun: !this.prithviService.isActive,
    };
  }

  async listPurposes(query: GetPurposesQueryDto) {
    return this.prithviForex.listPurposes({
      orderType: query.orderType,
      productType: query.productType,
    });
  }

  async getPurposeConfig(code: string) {
    if (!code?.trim()) {
      throw new BadRequestException('Purpose code is required');
    }
    return this.prithviForex.getPurposeConfig(code.trim());
  }

  async obtainToken(provider: RemittanceProvider) {
    this.assertProviderActive(provider);
    return this.getProviderService(provider).createAndStoreToken();
  }

  async refreshToken(provider: RemittanceProvider) {
    this.assertProviderActive(provider);
    return this.getProviderService(provider).refreshAndStoreToken();
  }

  async getTokenStatus(
    provider: RemittanceProvider,
    query: ProviderTokenStatusQueryDto,
  ) {
    return this.getProviderService(provider).getStoredTokenStatus({
      introspect: query.introspect,
    });
  }

  private assertOrderPayable(
    owned: {
      status?: string | null;
      paymentStatus?: string | null;
      bookingSource?: string | null;
      offlinePayment?: boolean;
      offlineUtrNumber?: string | null;
    },
    kind: 'online' | 'offline',
  ) {
    const paymentStatus = String(owned.paymentStatus ?? '')
      .trim()
      .toUpperCase();
    if (paymentStatus === 'PAID') {
      throw new BadRequestException('This order is already paid.');
    }

    if (owned.offlinePayment && owned.offlineUtrNumber) {
      throw new BadRequestException(
        'Offline payment has already been submitted for this order.',
      );
    }

    if (
      isForexOrderPayable({
        status: owned.status,
        paymentStatus: owned.paymentStatus,
        bookingSource: owned.bookingSource,
      })
    ) {
      return;
    }

    if (kind === 'offline') {
      throw new BadRequestException(
        'Offline payment is available once this booking is pending.',
      );
    }

    throw new BadRequestException(
      'Payment is available once this booking is pending.',
    );
  }

  private async overlayInitiateCharges(
    orderType: PrithviOrderType,
    order: ForexOrderDetailDto,
    purposeCode?: string,
  ): Promise<ForexOrderDetailDto> {
    const resolvedPurposeCode = purposeCode?.trim();
    if (!resolvedPurposeCode) {
      throw new BadRequestException(
        'Purpose is required to load provider charges for this order.',
      );
    }
    // Percentage / slab charges are based on customer-facing INR (X or Z × amount),
    // not provider live-TT amountInINR submitted to Prithvi.
    const sellRate = toFiniteNumber(
      order.customerSellRate ?? order.agentSellingRate,
      0,
    );
    const chargesInrAmount =
      sellRate > 0 && order.currencyAmount > 0
        ? Math.round(order.currencyAmount * sellRate * 100) / 100
        : order.amountInINR;
    const totalLrsAmount =
      typeof order.totalLrsAmount === 'number' &&
      Number.isFinite(order.totalLrsAmount) &&
      order.totalLrsAmount > 0
        ? order.totalLrsAmount
        : chargesInrAmount;
    return this.prithviForex.withProviderCharges(
      {
        orderType,
        productType: order.product,
        currencyCode: order.currency,
        currencyAmount: order.currencyAmount,
        inrAmount: chargesInrAmount,
        totalLrsAmount,
        purposeCode: resolvedPurposeCode,
      },
      order,
    );
  }

  private async persistInitiateOrders(
    userId: string,
    dto: InitiateForexRequestDto,
    data: Awaited<ReturnType<PrithviForexApiService['initiateForexRequest']>>,
    bookingSource: ForexBookingSourceEnum,
  ): Promise<void> {
    try {
      const forexRequest = data.forexRequest;
      const orders = data.orders ?? [];

      await Promise.all(
        orders.map(async (order, index) => {
          const detail = dto.orderDetails[index];
          return this.forexOrders.upsertFromInitiate({
            createdByUserId: userId,
            bookingSource,
            forexRequestId: forexRequest.id,
            prithviOrderId: order.id,
            orderType: forexRequest.orderType
              ? String(forexRequest.orderType)
              : String(dto.orderType),
            currency: order.currency ?? detail?.currency ?? null,
            product: order.product
              ? String(order.product)
              : (detail?.product ?? null),
            currencyAmount:
              order.currencyAmount ?? detail?.currencyAmount ?? null,
            amountInINR: order.amountInINR ?? detail?.amountInINR ?? null,
            sellingRate: order.sellingRate ?? detail?.sellingRate ?? null,
            agentSellingRate:
              order.agentSellingRate ?? detail?.agentSellingRate ?? null,
            ...(await this.commissionPersistFields(
              bookingSource,
              userId,
              detail,
              dto.purposeCode,
            )),
            gst: order.gst ?? detail?.gst ?? null,
            serviceCharge: order.serviceCharge ?? detail?.serviceCharge ?? null,
            totalAmount: order.totalAmount ?? order.amountInINR ?? null,
            orderCode: order.orderCode ?? null,
            paymentStatus: order.paymentStatus ?? 'NOT_PAID',
            status: 'DRAFT',
            statusLabel: 'Draft',
            sessionId: forexRequest.sessionId ?? null,
            sessionExpiresAt: forexRequest.sessionExpiresAt ?? null,
            purpose: dto.purposeCode?.trim() || null,
            providerCreatedAt:
              order.createdAt ??
              order.created_at ??
              forexRequest.createdAt ??
              null,
            isDryRun: !this.prithviForex.isActive,
          });
        }),
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to persist forex initiate orders locally: ${detail}`,
      );
    }
  }

  private async persistCompleteOrders(
    userId: string,
    forexRequestId: string,
    dto: CompleteForexRequestDto,
    data: Awaited<ReturnType<PrithviForexApiService['completeForexRequest']>>,
    bookingSource: ForexBookingSourceEnum,
  ): Promise<void> {
    try {
      const responseOrders = data.orders ?? [];
      const responseById = new Map(
        responseOrders.map((order) => [order.id, order]),
      );

      await Promise.all(
        dto.orders.map(async (payload) => {
          const snapshot = responseById.get(payload.orderId);
          const updated = await this.forexOrders.upsertFromComplete({
            prithviOrderId: payload.orderId,
            forexRequestId,
            createdByUserId: userId,
            bookingSource,
            status: 'PENDING',
            statusLabel: 'Pending Approval',
            paymentStatus: snapshot?.paymentStatus ?? null,
            orderCode: snapshot?.orderCode ?? null,
            currencyAmount: snapshot?.currencyAmount ?? null,
            amountInINR: snapshot?.amountInINR ?? null,
            sellingRate: snapshot?.sellingRate ?? payload.sellingRate,
            agentSellingRate: snapshot?.agentSellingRate ?? null,
            gst: snapshot?.gst ?? payload.gst,
            serviceCharge: snapshot?.serviceCharge ?? payload.serviceCharge,
            totalAmount: snapshot?.totalAmount ?? null,
            paidAmount: snapshot?.paidAmount ?? null,
            pendingAmount: snapshot?.pendingAmount ?? null,
            travelerName: snapshot?.travelerName ?? payload.travelerName,
            phoneNumber: snapshot?.phoneNumber ?? payload.phoneNumber,
            email: snapshot?.email ?? payload.email,
            panNumber: snapshot?.panNumber ?? payload.panNumber,
            purpose: snapshot?.purpose ?? payload.purpose,
            travelingCountries:
              snapshot?.travelingCountries ?? payload.travelingCountries,
            deliveryAddress:
              snapshot?.deliveryAddress ?? payload.deliveryAddress,
            pincode: snapshot?.pincode ?? payload.pincode,
            sourceOfFunds: snapshot?.sourceOfFunds ?? payload.sourceOfFunds,
            preferredDeliveryMode:
              snapshot?.preferredDeliveryMode ?? payload.preferredDeliveryMode,
            preferredPaymentMode:
              snapshot?.preferredPaymentMode ?? payload.preferredPaymentMode,
            startDate: payload.startDate ?? null,
            endDate: payload.endDate ?? null,
            ...this.remitterPersistFields(payload),
            providerUpdatedAt:
              snapshot?.updatedAt ??
              snapshot?.updated_at ??
              data.forexRequest.updatedAt ??
              data.forexRequest.updated_at ??
              null,
          });

          // If complete somehow ran without a prior initiate persist, seed a row.
          if (!updated) {
            await this.forexOrders.upsertFromInitiate({
              createdByUserId: userId,
              bookingSource,
              forexRequestId,
              prithviOrderId: payload.orderId,
              orderType: null,
              currency: snapshot?.currency ?? null,
              product: snapshot?.product ? String(snapshot.product) : null,
              currencyAmount: snapshot?.currencyAmount ?? null,
              amountInINR: snapshot?.amountInINR ?? null,
              sellingRate: snapshot?.sellingRate ?? payload.sellingRate,
              agentSellingRate: snapshot?.agentSellingRate ?? null,
              gst: snapshot?.gst ?? payload.gst,
              serviceCharge:
                snapshot?.serviceCharge ?? payload.serviceCharge,
              totalAmount: snapshot?.totalAmount ?? null,
              orderCode: snapshot?.orderCode ?? null,
              paymentStatus: snapshot?.paymentStatus ?? 'NOT_PAID',
              status: 'PENDING',
              statusLabel: 'Pending Approval',
              isDryRun: !this.prithviForex.isActive,
            });
            await this.forexOrders.upsertFromComplete({
              prithviOrderId: payload.orderId,
              forexRequestId,
              createdByUserId: userId,
              bookingSource,
              status: 'PENDING',
              statusLabel: 'Pending Approval',
              travelerName: payload.travelerName,
              phoneNumber: payload.phoneNumber,
              email: payload.email,
              panNumber: payload.panNumber,
              purpose: payload.purpose,
              travelingCountries: payload.travelingCountries,
              deliveryAddress: payload.deliveryAddress,
              pincode: payload.pincode,
              sourceOfFunds: payload.sourceOfFunds,
              preferredDeliveryMode: payload.preferredDeliveryMode,
              preferredPaymentMode: payload.preferredPaymentMode,
              startDate: payload.startDate,
              endDate: payload.endDate,
              sellingRate: payload.sellingRate,
              gst: payload.gst,
              serviceCharge: payload.serviceCharge,
              ...this.remitterPersistFields(payload),
            });
          }
        }),
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to persist forex complete orders locally: ${detail}`,
      );
    }
  }

  private async resolveBookingSource(
    userId: string,
  ): Promise<ForexBookingSourceEnum> {
    const user = await this.userModel
      .findById(String(userId))
      .select('userType')
      .lean()
      .exec();

    return user?.userType === UserTypeEnum.AGENT
      ? ForexBookingSourceEnum.AGENT
      : ForexBookingSourceEnum.SELF;
  }

  /**
   * Agent bookings: require X < customerSellRate (Z) ≤ card rate.
   * agentSellingRate forwarded to Prithvi is set to Z.
   * Provider sellingRate / amountInINR stay on the live Prithvi quote (Y).
   * Charges API inr_amount uses Z × currencyAmount.
   */
  private async normalizeAgentOrderRates(
    agentId: string,
    order: ForexOrderDetailDto,
    purposeCode?: string,
  ): Promise<ForexOrderDetailDto> {
    const customerSellRate = toFiniteNumber(
      order.customerSellRate ?? order.agentSellingRate,
      0,
    );
    const card = await this.resolveLiveCardSnapshot(
      agentId,
      order.currency,
      purposeCode,
    );
    const error = validateCustomerSellRate({
      customerSellRate,
      cardRate: card.cardRate,
      finpaySellRate: card.finpaySellRate,
    });
    if (error) {
      throw new BadRequestException(error);
    }

    return {
      ...order,
      customerSellRate,
      agentSellingRate: customerSellRate,
    };
  }

  /**
   * Customer (self) bookings: retail rate X = live TT + admin commission (per purpose).
   * Provider sellingRate / amountInINR stay on live TT (Y);
   * agentSellingRate / customerSellRate = X.
   * Charges API inr_amount uses X × currencyAmount.
   */
  private async normalizeCustomerOrderRates(
    order: ForexOrderDetailDto,
    purposeCode?: string,
  ): Promise<ForexOrderDetailDto> {
    const card = await this.resolveCustomerLiveCardSnapshot(
      order.currency,
      purposeCode,
    );
    const liveY = card.vendorRate;
    if (!(liveY > 0)) {
      throw new BadRequestException(
        'Live TT rate is unavailable for this currency. Try again shortly.',
      );
    }
    const retailRate = card.finpaySellRate > 0 ? card.finpaySellRate : liveY;
    if (card.cardRate > 0 && retailRate > card.cardRate) {
      throw new BadRequestException(
        `Customer rate (₹${retailRate}) is above the card rate ceiling (₹${card.cardRate}). Contact Finpay admin.`,
      );
    }

    return {
      ...order,
      customerSellRate: retailRate,
      agentSellingRate: retailRate,
    };
  }

  private async commissionPersistFields(
    bookingSource: ForexBookingSourceEnum,
    agentId: string,
    detail?: ForexOrderDetailDto | null,
    purposeCode?: string,
  ): Promise<{
    vendorRate?: number | null;
    finpaySellRate?: number | null;
    cardRate?: number | null;
    customerSellRate?: number | null;
    finpayCommissionPerUnit?: number | null;
    agentCommissionPerUnit?: number | null;
    finpayCommissionTotal?: number | null;
    agentCommissionTotal?: number | null;
  }> {
    if (!detail) {
      return {};
    }

    if (bookingSource === ForexBookingSourceEnum.SELF) {
      const card = await this.resolveCustomerLiveCardSnapshot(
        detail.currency,
        purposeCode,
      );
      const retailRate =
        card.finpaySellRate > 0 ? card.finpaySellRate : card.vendorRate;
      if (!(retailRate > 0)) {
        return {};
      }
      const commission = computeOrderCommissions({
        vendorRate: card.vendorRate,
        finpaySellRate: retailRate,
        cardRate: card.cardRate,
        customerSellRate: retailRate,
        currencyAmount: toFiniteNumber(detail.currencyAmount, 0),
      });
      return {
        vendorRate: commission.vendorRate,
        finpaySellRate: commission.finpaySellRate,
        cardRate: commission.cardRate,
        customerSellRate: commission.customerSellRate,
        finpayCommissionPerUnit: commission.finpayCommissionPerUnit,
        agentCommissionPerUnit: 0,
        finpayCommissionTotal: commission.finpayCommissionTotal,
        agentCommissionTotal: 0,
      };
    }

    if (bookingSource !== ForexBookingSourceEnum.AGENT) {
      return {};
    }

    const customerSellRate = toFiniteNumber(
      detail.customerSellRate ?? detail.agentSellingRate,
      0,
    );
    const card = await this.resolveLiveCardSnapshot(
      agentId,
      detail.currency,
      purposeCode,
    );
    const commission = computeOrderCommissions({
      vendorRate: card.vendorRate,
      finpaySellRate: card.finpaySellRate,
      cardRate: card.cardRate,
      customerSellRate,
      currencyAmount: toFiniteNumber(detail.currencyAmount, 0),
    });

    return {
      vendorRate: commission.vendorRate,
      finpaySellRate: commission.finpaySellRate,
      cardRate: commission.cardRate,
      customerSellRate: commission.customerSellRate,
      finpayCommissionPerUnit: commission.finpayCommissionPerUnit,
      agentCommissionPerUnit: commission.agentCommissionPerUnit,
      finpayCommissionTotal: commission.finpayCommissionTotal,
      agentCommissionTotal: commission.agentCommissionTotal,
    };
  }

  /** Y — live TT buy rate from cached Prithvi agent rates. */
  async getLiveTtBuyRate(currency: string): Promise<number> {
    const code = String(currency ?? '')
      .trim()
      .toUpperCase();
    if (!code) return 0;
    const live = await this.getLiveTtBuyRatesByCurrency();
    return live.get(code) ?? 0;
  }

  async getLiveTtBuyRatesByCurrency(): Promise<Map<string, number>> {
    const rates = await this.prithviService.getAgentRates({
      orderType: PrithviOrderType.BUY,
      productType: PrithviProductType.TT,
    });
    const map = new Map<string, number>();
    for (const row of rates.currencies) {
      const code = String(row.currencyCode ?? '')
        .trim()
        .toUpperCase();
      if (!code) continue;
      const rate =
        extractPrithviRate(
          row,
          PrithviOrderType.BUY,
          PrithviProductType.TT,
        ) ?? 0;
      if (rate > 0) map.set(code, rate);
    }
    return map;
  }

  private async resolveLiveCardSnapshot(
    agentId: string,
    currency: string,
    purposeCode?: string,
  ) {
    const [saved, liveY, options] = await Promise.all([
      this.agentCardRates.getOrDefault(agentId, currency, purposeCode),
      this.getLiveTtBuyRate(currency),
      this.cardRateConfig.getCalcOptions(currency),
    ]);
    return applyLiveTtToCardRates(saved, liveY, options);
  }

  /**
   * Retail snapshot for customers: always X = live TT + commission (c may be 0).
   * Commission is resolved per purpose (falls back to default/legacy).
   */
  private async resolveCustomerLiveCardSnapshot(
    currency: string,
    purposeCode?: string,
  ) {
    const [saved, liveY, options] = await Promise.all([
      this.customerCardRates.getOrDefault(currency, purposeCode),
      this.getLiveTtBuyRate(currency),
      this.cardRateConfig.getCalcOptions(currency),
    ]);
    const applied = applyLiveTtToCardRates(saved, liveY, options);
    const y = toFiniteNumber(liveY, 0);
    if (!(y > 0)) {
      return applied;
    }
    const commission = resolveFinpayCommission(applied);
    return {
      ...applied,
      vendorRate: y,
      finpayCommission: commission,
      finpaySellRate: roundMoney(y + commission),
      cardRate: applied.cardRate,
    };
  }

  async getMyCardRate(
    agentId: string,
    currency: string,
    purposeCode?: string,
  ) {
    const rate = await this.resolveLiveCardSnapshot(
      agentId,
      currency,
      purposeCode,
    );
    return {
      vendorRate: rate.vendorRate,
      finpayCommission: rate.finpayCommission ?? 0,
      finpaySellRate: rate.finpaySellRate,
      cardRate: rate.cardRate,
      purposeCode: String(purposeCode ?? '').trim() || undefined,
    };
  }

  async getCustomerCardRate(currency: string, purposeCode?: string) {
    const rate = await this.resolveCustomerLiveCardSnapshot(
      currency,
      purposeCode,
    );
    return {
      vendorRate: rate.vendorRate,
      finpayCommission: rate.finpayCommission ?? 0,
      finpaySellRate: rate.finpaySellRate,
      cardRate: rate.cardRate,
      purposeCode: String(purposeCode ?? '').trim() || undefined,
    };
  }

  async listCustomerCardRates() {
    const [rows, liveMap, configMap] = await Promise.all([
      this.customerCardRates.listAll(),
      this.getLiveTtBuyRatesByCurrency(),
      this.cardRateConfig.getCalcOptionsMap(),
    ]);
    const fromSaved = rows.map((row) => {
      const live = this.applyCustomerLiveOverlay(
        row,
        liveMap.get(row.currency) ?? 0,
        this.cardRateConfig.calcOptionsFor(row.currency, configMap),
      );
      return {
        ...live,
        purposeCode: row.purposeCode,
      };
    });

    // Include live TT currencies even when admin has not saved a row yet (c = 0).
    const currenciesWithRows = new Set(fromSaved.map((r) => r.currency));
    const extras = [...liveMap.keys()]
      .filter((currency) => !currenciesWithRows.has(currency))
      .map((currency) => {
        const y = liveMap.get(currency) ?? 0;
        return {
          ...this.applyCustomerLiveOverlay(
            {
              currency,
              purposeCode: '',
              vendorRate: 0,
              finpayCommission: 0,
              finpaySellRate: 0,
              cardRate: 0,
            },
            y,
            this.cardRateConfig.calcOptionsFor(currency, configMap),
          ),
          purposeCode: '',
        };
      });

    return [...fromSaved, ...extras].sort((a, b) => {
      const cur = String(a.currency).localeCompare(String(b.currency));
      if (cur !== 0) return cur;
      return String(a.purposeCode ?? '').localeCompare(
        String(b.purposeCode ?? ''),
      );
    });
  }

  /**
   * Public homepage rates: one retail X per currency.
   * Prefers legacy/default (empty purpose) when present; otherwise the first
   * purpose-specific rate for that currency.
   */
  async listPublicCustomerRetailRates() {
    const rows = await this.listCustomerCardRates();
    const byCurrency = new Map<
      string,
      { currency: string; finpaySellRate: number; purposeCode: string }
    >();
    for (const row of rows) {
      const currency = String(row.currency).toUpperCase();
      const finpaySellRate = Number(row.finpaySellRate);
      if (!(finpaySellRate > 0)) continue;
      const purposeCode = String(row.purposeCode ?? '');
      const existing = byCurrency.get(currency);
      if (!existing) {
        byCurrency.set(currency, { currency, finpaySellRate, purposeCode });
        continue;
      }
      // Prefer default/legacy empty purpose over purpose-specific.
      if (!existing.purposeCode && purposeCode) continue;
      if (existing.purposeCode && !purposeCode) {
        byCurrency.set(currency, { currency, finpaySellRate, purposeCode });
      }
    }
    return [...byCurrency.values()]
      .sort((a, b) => a.currency.localeCompare(b.currency))
      .map(({ currency, finpaySellRate }) => ({ currency, finpaySellRate }));
  }

  private applyCustomerLiveOverlay<
    T extends {
      currency?: string;
      vendorRate?: number;
      finpayCommission?: number | null;
      finpaySellRate?: number;
      cardRate?: number;
      id?: string;
      updatedAt?: string;
    },
  >(
    row: T,
    liveY: number,
    options?: CardRateCalcOptions,
  ) {
    const applied = applyLiveTtToCardRates(row, liveY, options);
    const y = toFiniteNumber(liveY, 0);
    const commission = resolveFinpayCommission(applied);
    return {
      ...applied,
      currency: String(row.currency ?? '').toUpperCase(),
      vendorRate: y,
      finpayCommission: commission,
      finpaySellRate: y > 0 ? roundMoney(y + commission) : 0,
    };
  }

  async listMyCardRates(agentId: string) {
    const [rows, liveMap, configMap] = await Promise.all([
      this.agentCardRates.listByAgent(agentId),
      this.getLiveTtBuyRatesByCurrency(),
      this.cardRateConfig.getCalcOptionsMap(),
    ]);
    return rows.map((row) => {
      const live = applyLiveTtToCardRates(
        row,
        liveMap.get(row.currency) ?? 0,
        this.cardRateConfig.calcOptionsFor(row.currency, configMap),
      );
      return {
        id: live.id,
        currency: live.currency,
        purposeCode: row.purposeCode,
        vendorRate: live.vendorRate,
        finpayCommission: live.finpayCommission,
        finpaySellRate: live.finpaySellRate,
        cardRate: live.cardRate,
        updatedAt: live.updatedAt,
      };
    });
  }

  async listAdminCommissions(query: {
    pageNumber?: number;
    pageSize?: number;
    fromDate?: string;
    toDate?: string;
    currency?: string;
    agentId?: string;
  }) {
    const result = await this.forexOrders.listCommissions({
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      fromDate: query.fromDate,
      toDate: query.toDate,
      currency: query.currency,
      createdByUserId: query.agentId,
      agentBookingsOnly: true,
    });

    const userIds = [
      ...new Set(result.data.map((row) => row.createdByUserId).filter(Boolean)),
    ];
    const users = userIds.length
      ? await this.userModel
          .find({ _id: { $in: userIds } })
          .select('_id firstName lastName email phoneNumber')
          .lean()
          .exec()
      : [];

    const userById = new Map(
      users.map((user) => {
        const displayName =
          [user.firstName, user.lastName].filter(Boolean).join(' ') ||
          user.email ||
          String(user._id);
        return [
          String(user._id),
          {
            id: String(user._id),
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            email: user.email ?? null,
            phoneNumber: user.phoneNumber ?? null,
            displayName,
          },
        ] as const;
      }),
    );

    return {
      data: result.data.map((row) => ({
        ...row,
        agent: userById.get(row.createdByUserId) ?? {
          id: row.createdByUserId,
          firstName: '',
          lastName: '',
          email: null,
          phoneNumber: null,
          displayName: row.createdByUserId,
        },
      })),
      meta: result.meta,
    };
  }

  async listMyCommissions(
    agentId: string,
    query: {
      pageNumber?: number;
      pageSize?: number;
      fromDate?: string;
      toDate?: string;
      currency?: string;
    },
  ) {
    return this.forexOrders.listCommissions({
      ...query,
      createdByUserId: agentId,
      agentBookingsOnly: true,
    });
  }

  iterateMyCommissionsForExport(
    agentId: string,
    query: { fromDate?: string; toDate?: string; currency?: string },
  ) {
    return this.forexOrders.iterateCommissionsForExport({
      ...query,
      createdByUserId: agentId,
      agentBookingsOnly: true,
    });
  }

  private getProviderService(provider: RemittanceProvider): PrithviExchangeService {
    if (provider === RemittanceProvider.PRITHVI) {
      return this.prithviService;
    }
    throw new BadRequestException(`Unknown remittance provider: ${provider}`);
  }

  private remitterPersistFields(payload: CompleteForexOrderDto) {
    const remitter = payload.remitterDetails;
    const agentCustomerId = payload.agentCustomerId?.trim() || null;

    if (!remitter) {
      return agentCustomerId ? { agentCustomerId } : {};
    }

    const travelerName = [remitter.firstName, remitter.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      travelerName: travelerName || payload.travelerName,
      phoneNumber: remitter.phoneNumber,
      email: remitter.email,
      panNumber: remitter.panNumber.toUpperCase(),
      pincode: remitter.pincode,
      remitterFirstName: remitter.firstName,
      remitterLastName: remitter.lastName ?? null,
      remitterDateOfBirth: remitter.dateOfBirth,
      remitterAddress: remitter.address,
      remitterCity: remitter.city,
      remitterState: remitter.state,
      ...(agentCustomerId ? { agentCustomerId } : {}),
    };
  }

  private assertProviderActive(provider: RemittanceProvider): void {
    const service = this.getProviderService(provider);
    if (!service.isActive) {
      throw new InternalServerErrorException(
        `Provider "${provider}" is inactive. Set ${provider.toUpperCase()}_ACTIVE_MODE=true in .env and configure credentials.`,
      );
    }
  }
}

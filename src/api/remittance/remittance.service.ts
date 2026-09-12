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
  PrithviExchangeService,
  PrithviForexApiService,
  PrithviForexRequestStatus,
  PrithviOrderType,
  PrithviProductType,
  extractPrithviRate,
} from 'src/services/prithvi-exchange';
import { AgentCardRateService } from 'src/services/agent-card-rate/agent-card-rate.service';
import { CustomerCardRateService } from 'src/services/customer-card-rate/customer-card-rate.service';
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
} from 'src/utils/agent-commission.util';
import {
  isAgentForexBooking,
  isForexOrderPayable,
} from 'src/utils/forex-payment.util';
import {
  CompleteForexRequestDto,
  CompleteForexOrderDto,
  ForexOrderDetailDto,
  GetAgentChargesQueryDto,
  GetForexOrdersDashboardQueryDto,
  GetPurposesQueryDto,
  GetRemittanceRatesQueryDto,
  InitiateForexRequestDto,
  ProviderTokenStatusQueryDto,
} from './dto';

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
    private readonly forexOrders: PrithviForexOrderService,
    private readonly forexOrderNotifications: ForexOrderNotificationService,
    private readonly filesService: FilesService,
    private readonly agentCardRates: AgentCardRateService,
    private readonly customerCardRates: CustomerCardRateService,
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
    return this.prithviForex.getAgentCharges({
      orderType: query.orderType,
      productType: query.productType,
      currencyCode: query.currencyCode,
      currencyAmount: query.currencyAmount,
      inrAmount: query.inrAmount,
      purposeCode: query.purposeCode,
    });
  }

  async initiateForex(dto: InitiateForexRequestDto, userId: string) {
    const bookingSource = await this.resolveBookingSource(userId);
    const orderDetails = await Promise.all(
      dto.orderDetails.map(async (order) => {
        const withCharges = await this.overlayInitiateCharges(
          dto.orderType,
          order,
          dto.purposeCode,
        );
        if (bookingSource === ForexBookingSourceEnum.AGENT) {
          return this.normalizeAgentOrderRates(String(userId), withCharges);
        }
        return this.normalizeCustomerOrderRates(withCharges);
      }),
    );
    const payload: InitiateForexRequestDto = { ...dto, orderDetails };

    const data = await this.prithviForex.initiateForexRequest({
      orderType: payload.orderType,
      orderDetails: payload.orderDetails.map((order) => {
        const { customerSellRate: _unused, ...prithviDetail } = order;
        void _unused;
        return prithviDetail;
      }),
    });

    await this.persistInitiateOrders(String(userId), payload, data, bookingSource);

    return data;
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

    const agentBooking = isAgentForexBooking(owned.bookingSource);
    if (kind === 'offline') {
      throw new BadRequestException(
        agentBooking
          ? 'Offline payment is available once this booking is pending.'
          : 'Offline payment is available only after your documents are approved and the order is awaiting funds.',
      );
    }

    throw new BadRequestException(
      agentBooking
        ? 'Payment is available once this booking is pending.'
        : 'Payment is available only after your documents are approved and the order is awaiting funds. We will notify you by email and SMS.',
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
    return this.prithviForex.withProviderCharges(
      {
        orderType,
        productType: order.product,
        currencyCode: order.currency,
        currencyAmount: order.currencyAmount,
        inrAmount: order.amountInINR,
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
   * Provider sellingRate / amountInINR stay on the live Prithvi quote.
   */
  private async normalizeAgentOrderRates(
    agentId: string,
    order: ForexOrderDetailDto,
  ): Promise<ForexOrderDetailDto> {
    const customerSellRate = toFiniteNumber(
      order.customerSellRate ?? order.agentSellingRate,
      0,
    );
    const card = await this.resolveLiveCardSnapshot(agentId, order.currency);
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
   * Customer (self) bookings: retail rate X = live TT + admin commission.
   * Provider sellingRate stays on live TT; agentSellingRate / customerSellRate = X.
   */
  private async normalizeCustomerOrderRates(
    order: ForexOrderDetailDto,
  ): Promise<ForexOrderDetailDto> {
    const card = await this.resolveCustomerLiveCardSnapshot(order.currency);
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
      const card = await this.resolveCustomerLiveCardSnapshot(detail.currency);
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
    const card = await this.resolveLiveCardSnapshot(agentId, detail.currency);
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

  private async resolveLiveCardSnapshot(agentId: string, currency: string) {
    const [saved, liveY] = await Promise.all([
      this.agentCardRates.getOrDefault(agentId, currency),
      this.getLiveTtBuyRate(currency),
    ]);
    return applyLiveTtToCardRates(saved, liveY);
  }

  /**
   * Retail snapshot for customers: always X = live TT + commission (c may be 0).
   */
  private async resolveCustomerLiveCardSnapshot(currency: string) {
    const [saved, liveY] = await Promise.all([
      this.customerCardRates.getOrDefault(currency),
      this.getLiveTtBuyRate(currency),
    ]);
    const applied = applyLiveTtToCardRates(saved, liveY);
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

  async getMyCardRate(agentId: string, currency: string) {
    const rate = await this.resolveLiveCardSnapshot(agentId, currency);
    return {
      vendorRate: rate.vendorRate,
      finpaySellRate: rate.finpaySellRate,
      cardRate: rate.cardRate,
    };
  }

  async getCustomerCardRate(currency: string) {
    const rate = await this.resolveCustomerLiveCardSnapshot(currency);
    return {
      vendorRate: rate.vendorRate,
      finpayCommission: rate.finpayCommission ?? 0,
      finpaySellRate: rate.finpaySellRate,
      cardRate: rate.cardRate,
    };
  }

  async listCustomerCardRates() {
    const [rows, liveMap] = await Promise.all([
      this.customerCardRates.listAll(),
      this.getLiveTtBuyRatesByCurrency(),
    ]);
    const fromSaved = new Map(
      rows.map((row) => {
        const live = this.applyCustomerLiveOverlay(
          row,
          liveMap.get(row.currency) ?? 0,
        );
        return [row.currency, live] as const;
      }),
    );

    // Include live TT currencies even when admin has not saved a row yet (c = 0).
    const codes = new Set([
      ...fromSaved.keys(),
      ...liveMap.keys(),
    ]);
    return [...codes]
      .sort()
      .map((currency) => {
        const existing = fromSaved.get(currency);
        if (existing) return existing;
        const y = liveMap.get(currency) ?? 0;
        return this.applyCustomerLiveOverlay(
          {
            currency,
            vendorRate: 0,
            finpayCommission: 0,
            finpaySellRate: 0,
            cardRate: 0,
          },
          y,
        );
      });
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
  >(row: T, liveY: number) {
    const applied = applyLiveTtToCardRates(row, liveY);
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
    const [rows, liveMap] = await Promise.all([
      this.agentCardRates.listByAgent(agentId),
      this.getLiveTtBuyRatesByCurrency(),
    ]);
    return rows.map((row) => {
      const live = applyLiveTtToCardRates(
        row,
        liveMap.get(row.currency) ?? 0,
      );
      return {
        id: live.id,
        currency: live.currency,
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

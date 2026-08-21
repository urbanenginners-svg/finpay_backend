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
  extractPrithviRate,
} from 'src/services/prithvi-exchange';
import { PrithviForexOrderService } from 'src/services/prithvi-exchange/prithvi-forex-order.service';
import { ForexOrderNotificationService } from 'src/services/prithvi-exchange/forex-order-notification.service';
import { User, UserDocument } from 'src/services/mongoose/schemas/user.schema';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import { FileResourceEnum } from 'src/utils/enums/file-resource.enum';
import { FilesService } from 'src/api/files/files.service';
import {
  CompleteForexRequestDto,
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
      scope: query.scope,
    });
  }

  async initiateForex(dto: InitiateForexRequestDto, userId: string) {
    const orderDetails = await Promise.all(
      dto.orderDetails.map((order) =>
        this.overlayInitiateCharges(dto.orderType, order),
      ),
    );
    const payload: InitiateForexRequestDto = { ...dto, orderDetails };

    const data = await this.prithviForex.initiateForexRequest({
      orderType: payload.orderType,
      orderDetails: payload.orderDetails,
    });

    await this.persistInitiateOrders(String(userId), payload, data);

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
    const data = await this.prithviForex.completeForexRequest({
      forexRequestId,
      orders: dto.orders,
    });

    await this.persistCompleteOrders(
      String(userId),
      forexRequestId,
      dto,
      data,
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

    const status = String(owned.status ?? '')
      .trim()
      .toUpperCase();
    if (status !== 'DOCUMENTS_APPROVED_AWAITING_FUNDS') {
      throw new BadRequestException(
        'Payment is available only after your documents are approved and the order is awaiting funds. We will notify you by email and SMS.',
      );
    }

    const paymentStatus = String(owned.paymentStatus ?? '')
      .trim()
      .toUpperCase();
    if (paymentStatus === 'PAID') {
      throw new BadRequestException('This order is already paid.');
    }

    return this.prithviForex.createPaymentLink({ orderId: trimmedOrderId });
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
   * Serve forex orders from local MongoDB (booked via Finpay + hourly sync).
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
      q: query.q,
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
      users.map((user) => [
        String(user._id),
        {
          id: String(user._id),
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
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
          displayName: row.createdByUserId,
        },
      })),
      meta: result.meta,
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

  private async overlayInitiateCharges(
    orderType: PrithviOrderType,
    order: ForexOrderDetailDto,
  ): Promise<ForexOrderDetailDto> {
    return this.prithviForex.withProviderCharges(
      {
        orderType,
        productType: order.product,
        currencyCode: order.currency,
        currencyAmount: order.currencyAmount,
        inrAmount: order.amountInINR,
        scope: 'global',
      },
      order,
    );
  }

  private async persistInitiateOrders(
    userId: string,
    dto: InitiateForexRequestDto,
    data: Awaited<ReturnType<PrithviForexApiService['initiateForexRequest']>>,
  ): Promise<void> {
    try {
      const forexRequest = data.forexRequest;
      const orders = data.orders ?? [];

      await Promise.all(
        orders.map(async (order, index) => {
          const detail = dto.orderDetails[index];
          return this.forexOrders.upsertFromInitiate({
            createdByUserId: userId,
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

  private getProviderService(provider: RemittanceProvider): PrithviExchangeService {
    if (provider === RemittanceProvider.PRITHVI) {
      return this.prithviService;
    }
    throw new BadRequestException(`Unknown remittance provider: ${provider}`);
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

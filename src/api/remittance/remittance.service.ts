import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import {
  PrithviExchangeService,
  PrithviForexApiService,
  extractPrithviRate,
} from 'src/services/prithvi-exchange';
import { PrithviForexOrderService } from 'src/services/prithvi-exchange/prithvi-forex-order.service';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import {
  CompleteForexRequestDto,
  GetForexOrdersDashboardQueryDto,
  GetPurposesQueryDto,
  GetRemittanceRatesQueryDto,
  InitiateForexRequestDto,
  ProviderTokenStatusQueryDto,
} from './dto';

@Injectable()
export class RemittanceService {
  private readonly logger = new Logger(RemittanceService.name);

  constructor(
    private readonly prithviService: PrithviExchangeService,
    private readonly prithviForex: PrithviForexApiService,
    private readonly forexOrders: PrithviForexOrderService,
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

  async initiateForex(dto: InitiateForexRequestDto, userId: string) {
    const data = await this.prithviForex.initiateForexRequest({
      orderType: dto.orderType,
      orderDetails: dto.orderDetails,
    });

    await this.persistInitiateOrders(String(userId), dto, data);

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

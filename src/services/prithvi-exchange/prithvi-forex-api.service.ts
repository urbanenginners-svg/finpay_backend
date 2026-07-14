import axios, { isAxiosError } from 'axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AppConfigService } from 'src/services/env/env.service';
import {
  PRITHVI_API_PATHS,
  PRITHVI_FOREX_DRAFT_TTL_MS,
} from './prithvi-exchange.constants';
import { PrithviApiLogService } from './prithvi-api-log.service';
import { PrithviExchangeService } from './prithvi-exchange.service';
import {
  CompleteForexRequestParams,
  CompleteForexRequestResult,
  GetForexOrdersDashboardParams,
  GetPurposesParams,
  InitiateForexRequestParams,
  InitiateForexRequestResult,
  PrithviApiCallType,
  PrithviApiResponse,
  PrithviForexOrdersDashboardResult,
  PrithviForexRequestStatus,
  PrithviOrderType,
  PrithviProductType,
  PrithviPurpose,
  PrithviPurposeConfig,
} from './prithvi-exchange.types';

const SENSITIVE_KEYS = new Set([
  'client_secret',
  'access_token',
  'refresh_token',
  'token',
  'panNumber',
]);

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'api-key',
]);

const REDACTED = '[REDACTED]';

type JsonRequestOptions = {
  method: 'GET' | 'POST';
  callType: PrithviApiCallType;
  path: string;
  body?: Record<string, unknown> | null;
  params?: Record<string, unknown> | null;
  clientErrorMessage: string;
  serverErrorMessage: string;
};

@Injectable()
export class PrithviForexApiService {
  private readonly logger = new Logger(PrithviForexApiService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly prithvi: PrithviExchangeService,
    private readonly apiLog: PrithviApiLogService,
  ) {}

  get isActive(): boolean {
    return this.prithvi.isActive;
  }

  /**
   * Step 1 — reserve inventory + create DRAFT forex request (20-minute rate lock).
   */
  async initiateForexRequest(
    params: InitiateForexRequestParams,
  ): Promise<InitiateForexRequestResult> {
    const requestBody = {
      orderType: params.orderType,
      orderDetails: params.orderDetails,
    };

    if (!this.isActive) {
      return this.dryRunInitiate(params);
    }

    return this.requestJson<InitiateForexRequestResult>({
      method: 'POST',
      callType: PrithviApiCallType.FOREX_INITIATE,
      path: PRITHVI_API_PATHS.FOREX_INITIATE,
      body: requestBody,
      params: null,
      clientErrorMessage:
        'Unable to initiate forex request. Please check your order details and try again.',
      serverErrorMessage:
        'Unable to initiate forex request right now. Please try again later.',
    }).then((result) => this.normalizeInitiateResult(result));
  }

  /**
   * Step 2 — finalize DRAFT with traveler / KYC / delivery details within the rate lock window.
   */
  async completeForexRequest(
    params: CompleteForexRequestParams,
  ): Promise<CompleteForexRequestResult> {
    const requestBody = { orders: params.orders };
    const path = PRITHVI_API_PATHS.FOREX_COMPLETE.replace(
      ':id',
      params.forexRequestId,
    );

    if (!this.isActive) {
      return this.dryRunComplete(params.forexRequestId);
    }

    return this.requestJson<CompleteForexRequestResult>({
      method: 'POST',
      callType: PrithviApiCallType.FOREX_COMPLETE,
      path,
      body: requestBody,
      params: null,
      clientErrorMessage:
        'Unable to complete forex request. Session may have expired — please start a new booking.',
      serverErrorMessage:
        'Unable to complete forex request right now. Please try again later.',
    });
  }

  /**
   * Paginated forex orders dashboard from Prithvi.
   */
  async getOrdersDashboard(
    params: GetForexOrdersDashboardParams = {},
  ): Promise<PrithviForexOrdersDashboardResult> {
    const requestParams = this.omitUndefined({
      pageNumber: params.pageNumber ?? 1,
      pageSize: params.pageSize ?? 10,
      status: params.status,
      product: params.product,
      fromDate: params.fromDate,
      toDate: params.toDate,
    });

    if (!this.isActive) {
      return this.dryRunOrdersDashboard(requestParams);
    }

    const envelope = await this.requestJsonEnvelope({
      method: 'GET',
      callType: PrithviApiCallType.FOREX_ORDERS_DASHBOARD,
      path: PRITHVI_API_PATHS.FOREX_ORDERS_DASHBOARD,
      body: null,
      params: requestParams,
      clientErrorMessage: 'Unable to load forex orders. Please try again.',
      serverErrorMessage:
        'Unable to load forex orders right now. Please try again later.',
    });

    return this.normalizeDashboardResponse(envelope);
  }

  /**
   * LRS purpose categories for the selected order/product context.
   */
  async listPurposes(params: GetPurposesParams = {}): Promise<PrithviPurpose[]> {
    const requestParams = this.omitUndefined({
      orderType: params.orderType,
      productType: params.productType,
    });

    if (!this.isActive) {
      return this.dryRunPurposes();
    }

    return this.requestJson<PrithviPurpose[]>({
      method: 'GET',
      callType: PrithviApiCallType.PURPOSE_LIST,
      path: PRITHVI_API_PATHS.PURPOSE_LIST,
      body: null,
      params: requestParams,
      clientErrorMessage: 'Unable to load purposes. Please try again.',
      serverErrorMessage:
        'Unable to load purposes right now. Please try again later.',
    });
  }

  /**
   * KYC documents + allowed products for a purpose code.
   */
  async getPurposeConfig(code: string): Promise<PrithviPurposeConfig> {
    const path = PRITHVI_API_PATHS.PURPOSE_CONFIG.replace(
      ':code',
      encodeURIComponent(code),
    );

    if (!this.isActive) {
      return this.dryRunPurposeConfig(code);
    }

    return this.requestJson<PrithviPurposeConfig>({
      method: 'GET',
      callType: PrithviApiCallType.PURPOSE_CONFIG,
      path,
      body: null,
      params: null,
      clientErrorMessage: 'Unable to load purpose configuration.',
      serverErrorMessage:
        'Unable to load purpose configuration right now. Please try again later.',
    });
  }

  private normalizeInitiateResult(
    result: InitiateForexRequestResult,
  ): InitiateForexRequestResult {
    const forexRequest = result?.forexRequest;
    const nestedOrders =
      result?.orders ??
      (
        result as unknown as {
          forexRequest?: { orders?: InitiateForexRequestResult['orders'] };
        }
      )?.forexRequest?.orders;

    if (!forexRequest) {
      return result;
    }

    return {
      forexRequest,
      orders: (nestedOrders ?? []).map((order) => ({
        id: order.id,
        currency: order.currency,
        product: order.product,
        currencyAmount: order.currencyAmount,
        amountInINR: order.amountInINR,
      })),
    };
  }

  private dryRunInitiate(
    params: InitiateForexRequestParams,
  ): InitiateForexRequestResult {
    const forexRequestId = randomUUID();
    const sessionExpiresAt = new Date(
      Date.now() + PRITHVI_FOREX_DRAFT_TTL_MS,
    ).toISOString();

    this.logger.warn(
      `PRITHVI_ACTIVE_MODE is not "true"; returning dry-run forex initiate. orderType=${params.orderType}`,
    );

    const result: InitiateForexRequestResult = {
      forexRequest: {
        id: forexRequestId,
        sessionId: `sess_${Date.now()}`,
        status: PrithviForexRequestStatus.DRAFT,
        sessionExpiresAt,
        orderType: params.orderType,
      },
      orders: params.orderDetails.map((detail) => ({
        id: randomUUID(),
        currency: detail.currency,
        product: detail.product,
        currencyAmount: detail.currencyAmount,
        amountInINR: detail.amountInINR,
      })),
    };

    void this.apiLog
      .create({
        callType: PrithviApiCallType.FOREX_INITIATE,
        method: 'POST',
        url: this.buildUrl(PRITHVI_API_PATHS.FOREX_INITIATE),
        requestBody: this.sanitizeObject(
          params as unknown as Record<string, unknown>,
        ),
        requestParams: null,
        requestHeaders: this.sanitizeHeaders({
          Authorization: 'Bearer [REDACTED]',
          'Content-Type': 'application/json',
          accept: 'application/json',
        }),
        httpStatus: null,
        responseBody: result as unknown as Record<string, unknown>,
        success: true,
        errorMessage: null,
        durationMs: 0,
        isDryRun: true,
      })
      .catch((e: unknown) =>
        this.logger.error(
          `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );

    return result;
  }

  private dryRunComplete(forexRequestId: string): CompleteForexRequestResult {
    this.logger.warn(
      `PRITHVI_ACTIVE_MODE is not "true"; returning dry-run forex complete. id=${forexRequestId}`,
    );

    const result: CompleteForexRequestResult = {
      forexRequest: {
        id: forexRequestId,
        status: PrithviForexRequestStatus.PENDING,
      },
    };

    void this.apiLog
      .create({
        callType: PrithviApiCallType.FOREX_COMPLETE,
        method: 'POST',
        url: this.buildUrl(
          PRITHVI_API_PATHS.FOREX_COMPLETE.replace(':id', forexRequestId),
        ),
        requestBody: { forexRequestId },
        requestParams: null,
        requestHeaders: this.sanitizeHeaders({
          Authorization: 'Bearer [REDACTED]',
          'Content-Type': 'application/json',
          accept: 'application/json',
        }),
        httpStatus: null,
        responseBody: result as unknown as Record<string, unknown>,
        success: true,
        errorMessage: null,
        durationMs: 0,
        isDryRun: true,
      })
      .catch((e: unknown) =>
        this.logger.error(
          `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );

    return result;
  }

  private dryRunOrdersDashboard(
    params: Record<string, unknown>,
  ): PrithviForexOrdersDashboardResult {
    const page = Number(params.pageNumber ?? 1);
    const limit = Number(params.pageSize ?? 10);
    const statusFilter =
      typeof params.status === 'string' ? params.status : undefined;

    const sample: PrithviForexOrdersDashboardResult['data'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: PrithviForexRequestStatus.PENDING,
        orderType: PrithviOrderType.BUY,
        createdAt: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440099',
        status: PrithviForexRequestStatus.APPROVED,
        orderType: PrithviOrderType.BUY,
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ];

    const filtered = statusFilter
      ? sample.filter((row) => row.status === statusFilter)
      : sample;

    return {
      data: filtered,
      meta: { total: filtered.length, page, limit },
    };
  }

  private dryRunPurposes(): PrithviPurpose[] {
    return [
      {
        code: 'S0001',
        name: 'Leisure/Holiday/Personal Visit',
        description: 'Personal tourism or travel overseas',
        isActive: true,
      },
      {
        code: 'S0002',
        name: 'Business Travel',
        description: 'Overseas travel for business meetings',
        isActive: true,
      },
      {
        code: 'S0003',
        name: 'Medical Treatment Abroad',
        description: 'Medical treatment and related expenses overseas',
        isActive: true,
      },
      {
        code: 'S0004',
        name: 'Education / Studies Abroad',
        description: 'Tuition and living expenses for overseas education',
        isActive: true,
      },
    ];
  }

  private dryRunPurposeConfig(code: string): PrithviPurposeConfig {
    const purposes = this.dryRunPurposes();
    const match = purposes.find((p) => p.code === code) ?? purposes[0];

    return {
      code: match.code,
      name: match.name,
      documentsRequired: ['Passport', 'Visa', 'Air Ticket'],
      allowedProducts: [
        PrithviProductType.CASH,
        PrithviProductType.CARD,
        PrithviProductType.TT,
      ],
    };
  }

  private normalizeDashboardResponse(
    envelope: PrithviApiResponse<unknown> & {
      meta?: PrithviForexOrdersDashboardResult['meta'];
    },
  ): PrithviForexOrdersDashboardResult {
    const data = envelope.data;
    const meta = envelope.meta;

    if (Array.isArray(data) && meta) {
      return { data: data as PrithviForexOrdersDashboardResult['data'], meta };
    }

    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as PrithviForexOrdersDashboardResult).data)
    ) {
      const nested = data as PrithviForexOrdersDashboardResult;
      return {
        data: nested.data,
        meta: nested.meta ?? meta ?? { total: nested.data.length, page: 1, limit: 10 },
      };
    }

    if (Array.isArray(data)) {
      return {
        data: data as PrithviForexOrdersDashboardResult['data'],
        meta: meta ?? {
          total: data.length,
          page: 1,
          limit: data.length || 10,
        },
      };
    }

    return { data: [], meta: meta ?? { total: 0, page: 1, limit: 10 } };
  }

  /**
   * Authenticated JSON call; unwraps `{ success, data }` and returns `data`.
   */
  private async requestJson<T>(options: JsonRequestOptions): Promise<T> {
    const envelope = await this.requestJsonEnvelope(options);
    return envelope.data as T;
  }

  /**
   * Authenticated JSON call returning the full success envelope
   * (needed when `meta` sits next to `data`, e.g. orders dashboard).
   */
  private async requestJsonEnvelope(
    options: JsonRequestOptions,
  ): Promise<
    PrithviApiResponse<unknown> & {
      meta?: PrithviForexOrdersDashboardResult['meta'];
    }
  > {
    const url = this.buildUrl(options.path);
    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let responseBody: Record<string, unknown> | null = null;
    let requestHeaders: Record<string, unknown> | null = null;
    let success = false;
    let errorMessage: string | null = null;

    const buildHeaders = (token: string) => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    });

    const execute = (token: string) =>
      axios.request<
        PrithviApiResponse<unknown> & {
          meta?: PrithviForexOrdersDashboardResult['meta'];
        }
      >({
        method: options.method,
        url,
        data: options.body ?? undefined,
        params: options.params ?? undefined,
        headers: buildHeaders(token),
        validateStatus: () => true,
      });

    try {
      let token = await this.prithvi.getValidAccessToken();
      requestHeaders = this.sanitizeHeaders(buildHeaders(token));
      let response = await execute(token);

      if (this.isAuthTokenRejected(response.status, response.data)) {
        this.logger.warn(
          `Prithvi ${options.callType} received 401; refreshing OAuth token and retrying once.`,
        );
        token = await this.prithvi.getValidAccessToken({ forceRefresh: true });
        requestHeaders = this.sanitizeHeaders(buildHeaders(token));
        response = await execute(token);
      }

      httpStatus = response.status;
      responseBody = this.sanitizeObject(
        response.data as unknown as Record<string, unknown>,
      );

      if (response.status >= 400 && response.status < 500) {
        errorMessage = `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
        const providerMessage = this.extractProviderMessage(response.data);
        throw new BadRequestException(
          providerMessage ?? options.clientErrorMessage,
        );
      }

      if (response.status < 200 || response.status >= 300) {
        errorMessage = `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
        this.logger.error(
          `Prithvi ${options.callType} HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(options.serverErrorMessage);
      }

      if (!response.data?.success) {
        errorMessage = `API error: ${JSON.stringify(response.data)}`;
        const providerMessage = this.extractProviderMessage(response.data);
        this.logger.error(
          `Prithvi ${options.callType} API error: ${JSON.stringify(response.data)}`,
        );
        throw new BadRequestException(
          providerMessage ?? options.clientErrorMessage,
        );
      }

      success = true;
      return response.data;
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      errorMessage = isAxiosError(err)
        ? `Network error: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
      this.logger.error(
        `Prithvi ${options.callType} failed: ${errorMessage}`,
      );
      throw new InternalServerErrorException(options.serverErrorMessage);
    } finally {
      void this.apiLog
        .create({
          callType: options.callType,
          method: options.method,
          url,
          requestBody: options.body
            ? this.sanitizeObject(options.body)
            : null,
          requestParams: options.params
            ? this.sanitizeObject(options.params as Record<string, unknown>)
            : null,
          requestHeaders,
          httpStatus,
          responseBody,
          success,
          errorMessage,
          durationMs: Date.now() - startedAt,
          isDryRun: false,
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
  }

  private extractProviderMessage(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const record = data as {
      message?: string;
      error?: { message?: string };
    };
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }
    if (
      typeof record.error?.message === 'string' &&
      record.error.message.trim()
    ) {
      return record.error.message.trim();
    }
    return null;
  }

  private isAuthTokenRejected(status: number, data: unknown): boolean {
    if (status !== 401) return false;
    if (data && typeof data === 'object') {
      const error = (data as { error?: { code?: string; message?: string } })
        .error;
      if (error?.code === 'INVALID_TOKEN') return true;
      const message = error?.message?.toLowerCase() ?? '';
      if (
        message.includes('invalid') &&
        (message.includes('token') || message.includes('expired'))
      ) {
        return true;
      }
    }
    return true;
  }

  private buildUrl(path: string): string {
    const baseUrl = this.config.get('PRITHVI_BASE_URL')?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new InternalServerErrorException(
        'Prithvi Exchange provider is not configured correctly.',
      );
    }
    return `${baseUrl}${path}`;
  }

  private omitUndefined(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null && value !== '') {
        result[key] = value;
      }
    }
    return result;
  }

  private sanitizeHeaders(
    headers: Record<string, string> | null | undefined,
  ): Record<string, unknown> | null {
    if (!headers) return null;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_HEADERS.has(lowerKey)) {
        if (
          lowerKey === 'authorization' &&
          value.toLowerCase().startsWith('bearer ')
        ) {
          result[key] = 'Bearer [REDACTED]';
        } else {
          result[key] = REDACTED;
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private sanitizeObject(
    obj: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      return { value: obj };
    }
    const clone: Record<string, unknown> = { ...obj };
    for (const key of Object.keys(clone)) {
      if (SENSITIVE_KEYS.has(key)) {
        clone[key] = REDACTED;
      }
    }
    return clone;
  }
}

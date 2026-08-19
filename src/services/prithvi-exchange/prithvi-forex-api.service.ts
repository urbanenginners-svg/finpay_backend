import axios, { isAxiosError } from 'axios';
import FormData = require('form-data');
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
  PRITHVI_DEFAULT_PAYMENT_REDIRECT_URL,
  PRITHVI_FOREX_DRAFT_TTL_MS,
} from './prithvi-exchange.constants';
import { PrithviApiLogService } from './prithvi-api-log.service';
import { PrithviExchangeService } from './prithvi-exchange.service';
import { PrithviForexOrderService } from './prithvi-forex-order.service';
import { ForexOrderNotificationService } from './forex-order-notification.service';
import { PrithviPurposeCacheService } from './prithvi-purpose-cache.service';
import {
  CompleteForexOrderPayload,
  CompleteForexOrderSnapshot,
  CompleteForexRequestParams,
  CompleteForexRequestResult,
  GetAgentChargesParams,
  GetForexOrdersDashboardParams,
  GetPurposesParams,
  InitiateForexRequestParams,
  InitiateForexRequestResult,
  PrithviAgentChargesResult,
  PrithviApiCallType,
  PrithviApiResponse,
  PrithviChargeLine,
  PrithviChargeLineRaw,
  PrithviForexOrdersDashboardResult,
  PrithviForexRequestStatus,
  PrithviOrderType,
  PrithviProductType,
  PrithviPurpose,
  PrithviPurposeConfig,
  SyncForexOrdersFromProviderResult,
  UploadForexOrderDocumentParams,
  UploadForexOrderDocumentResult,
  CreatePaymentLinkParams,
  CreatePaymentLinkResult,
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

/** Prithvi forex APIs expect title-case order types (`Buy` / `Sell`), not `BUY` / `SELL`. */
function toPrithviApiOrderType(orderType: PrithviOrderType | string): 'Buy' | 'Sell' {
  return String(orderType).toUpperCase() === 'SELL' ? 'Sell' : 'Buy';
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function unwrapChargeLines(raw: unknown): PrithviChargeLineRaw[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  for (const key of ['data', 'charges', 'items', 'result']) {
    const nested = obj[key];
    if (Array.isArray(nested)) return nested as PrithviChargeLineRaw[];
    if (nested && typeof nested === 'object') {
      const inner = unwrapChargeLines(nested);
      if (inner.length) return inner;
    }
  }
  return [];
}

function isChargeInRange(
  minAmount: number | null,
  maxAmount: number | null,
  inrAmount: number,
): boolean {
  if (minAmount != null && inrAmount < minAmount) return false;
  if (maxAmount != null && inrAmount > maxAmount) return false;
  return true;
}

function resolveLineTotalCharge(
  raw: PrithviChargeLineRaw,
  inrAmount: number,
): number {
  const record = raw as PrithviChargeLineRaw & Record<string, unknown>;
  const calcType = String(
    raw.calculation_type ?? record.calculationType ?? '',
  ).toUpperCase();
  const prithiviCharge = toFiniteNumber(
    firstDefined(raw.prithiviCharge, record.prithivi_charge),
    NaN,
  );
  const totalCharge = toFiniteNumber(
    firstDefined(raw.totalCharge, record.total_charge),
    NaN,
  );

  // PERCENTAGE lines (e.g. GST): Prithvi initiate validates `prithiviCharge`.
  if (calcType === 'PERCENTAGE' && Number.isFinite(prithiviCharge) && prithiviCharge > 0) {
    return Math.round(prithiviCharge * 100) / 100;
  }
  if (Number.isFinite(totalCharge) && totalCharge > 0) {
    return Math.round(totalCharge * 100) / 100;
  }
  if (Number.isFinite(prithiviCharge) && prithiviCharge > 0) {
    return Math.round(prithiviCharge * 100) / 100;
  }

  const value = toFiniteNumber(
    firstDefined(raw.calculation_value, record.calculationValue),
    0,
  );
  const additional = toFiniteNumber(
    firstDefined(raw.additional_charge, record.additionalCharge),
    0,
  );
  const maxCap = toOptionalNumber(firstDefined(raw.max_cap, record.maxCap));
  let total =
    calcType === 'PERCENTAGE'
      ? inrAmount * (value / 100) + additional
      : value + additional;
  if (maxCap != null && total > maxCap) total = maxCap;
  return Math.round(total * 100) / 100;
}

/**
 * Map a charge line onto initiate/complete fields.
 * `charge_code` SERVICE_CHARGE is the service fee Prithvi validates, even when
 * `charge_type` is a display label like "Nostro Charge".
 */
function resolveChargeFieldKey(
  item: Pick<PrithviChargeLineRaw, 'charge_type' | 'charge_code' | 'charge_name'> &
    Partial<PrithviChargeLine>,
): 'gst' | 'serviceCharge' | 'deliveryCharge' | 'nostroCharge' | null {
  const code = String(item.chargeCode ?? item.charge_code ?? '').toUpperCase();
  const label = [
    item.chargeType,
    item.charge_type,
    item.chargeName,
    item.charge_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (label.includes('gst') || code.includes('GST')) return 'gst';
  if (label.includes('delivery') || code.includes('DELIVERY')) {
    return 'deliveryCharge';
  }
  if (code.includes('SERVICE') || label.includes('service')) {
    return 'serviceCharge';
  }
  if (label.includes('nostro') || code.includes('NOSTRO')) {
    return 'nostroCharge';
  }
  return null;
}

function bookingChargeFieldsFromResult(charges: PrithviAgentChargesResult): {
  gst: number;
  serviceCharge: number;
  deliveryCharge?: number;
  nostroCharge?: number;
  prithiviCharge?: number;
} {
  const fields: {
    gst: number;
    serviceCharge: number;
    deliveryCharge?: number;
    nostroCharge?: number;
    prithiviCharge?: number;
  } = {
    gst: charges.gst,
    serviceCharge: charges.serviceCharge,
  };
  if ((charges.deliveryCharge ?? 0) > 0) {
    fields.deliveryCharge = charges.deliveryCharge;
  }
  if ((charges.nostroCharge ?? 0) > 0) {
    fields.nostroCharge = charges.nostroCharge;
  }
  if ((charges.prithiviCharge ?? 0) > 0) {
    fields.prithiviCharge = charges.prithiviCharge;
  }
  return fields;
}

function normalizeChargeLine(
  raw: PrithviChargeLineRaw,
  inrAmount: number,
): PrithviChargeLine {
  const record = raw as PrithviChargeLineRaw & Record<string, unknown>;
  const totalCharge = resolveLineTotalCharge(raw, inrAmount);
  return {
    component: raw.component,
    sourceScope: raw.source_scope,
    chargeType: String(
      raw.charge_type ?? raw.charge_name ?? raw.charge_code ?? '',
    ),
    chargeCode: String(raw.charge_code ?? ''),
    orderType: raw.order_type,
    productType: raw.product_type,
    calculationType: String(raw.calculation_type ?? ''),
    calculationValue: toFiniteNumber(raw.calculation_value, 0),
    additionalCharge: toOptionalNumber(raw.additional_charge),
    maxCap: toOptionalNumber(raw.max_cap),
    minAmount: toOptionalNumber(
      firstDefined(raw.min_amount, record.minAmount),
    ),
    maxAmount: toOptionalNumber(
      firstDefined(raw.max_amount, record.maxAmount),
    ),
    currencyCode: raw.currency_code,
    chargeName: raw.charge_name ?? null,
    prithiviCharge: toFiniteNumber(raw.prithiviCharge, totalCharge),
    partnerCharge: toFiniteNumber(raw.partnerCharge, 0),
    totalCharge,
  };
}

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
    private readonly purposeCache: PrithviPurposeCacheService,
    private readonly forexOrders: PrithviForexOrderService,
    private readonly forexOrderNotifications: ForexOrderNotificationService,
  ) {}

  get isActive(): boolean {
    return this.prithvi.isActive;
  }

  /**
   * Charge schedule for the selected order/product/amount context.
   * Proxies Prithvi GET /charges (FIXED / PERCENTAGE line items with totals).
   */
  async getAgentCharges(
    params: GetAgentChargesParams,
  ): Promise<PrithviAgentChargesResult> {
    if (!this.isActive) {
      return this.dryRunAgentCharges(params);
    }

    const scope = (params.scope ?? 'global').trim() || 'global';
    const raw = await this.requestJson<unknown>({
      method: 'GET',
      callType: PrithviApiCallType.AGENT_CHARGES,
      path: PRITHVI_API_PATHS.AGENT_CHARGES,
      body: null,
      params: {
        order_type: String(params.orderType).toUpperCase(),
        product_type: String(params.productType).toUpperCase(),
        currency_code: String(params.currencyCode).toUpperCase(),
        currency_amount: params.currencyAmount,
        inr_amount: params.inrAmount,
        scope,
      },
      clientErrorMessage:
        'Unable to load charges. Please check order, product, currency, and amount and try again.',
      serverErrorMessage:
        'Unable to load charges right now. Please try again later.',
    });

    return this.normalizeAgentCharges(unwrapChargeLines(raw), params, scope);
  }

  /**
   * Replace client gst/serviceCharge/etc with provider GET /charges amounts.
   * Prithvi rejects initiate/complete when submitted GST or service fee drift.
   */
  async withProviderCharges<
    T extends {
      gst: number;
      serviceCharge: number;
      deliveryCharge?: number;
      nostroCharge?: number;
      prithiviCharge?: number;
    },
  >(params: GetAgentChargesParams, order: T): Promise<T> {
    const charges = await this.getAgentCharges(params);
    const fields = bookingChargeFieldsFromResult(charges);
    this.logger.log(
      `Applied provider charges gst=${fields.gst} serviceCharge=${fields.serviceCharge} for ${params.currencyCode} ${params.currencyAmount} ${params.productType} from items=${JSON.stringify(
        charges.items.map((item) => ({
          type: item.chargeType,
          code: item.chargeCode,
          calc: item.calculationType,
          prithiviCharge: item.prithiviCharge,
          total: item.totalCharge,
          min: item.minAmount,
          max: item.maxAmount,
        })),
      )}`,
    );
    const { deliveryCharge: _delivery, nostroCharge: _nostro, prithiviCharge: _prithivi, ...rest } =
      order;
    return {
      ...rest,
      ...fields,
    } as T;
  }

  /**
   * Step 1 — reserve inventory + create DRAFT forex request (20-minute rate lock).
   */
  async initiateForexRequest(
    params: InitiateForexRequestParams,
  ): Promise<InitiateForexRequestResult> {
    const requestBody = {
      orderType: toPrithviApiOrderType(params.orderType),
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
    const requestBody = {
      orders: params.orders.map((order) => this.toPrithviCompleteOrder(order)),
    };
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
    }).then((result) => this.normalizeCompleteResult(result));
  }

  /**
   * Generate a payment link for a completed forex order.
   * Proxies to Prithvi POST /orders/:orderId/payment-link with redirectUrl.
   */
  async createPaymentLink(
    params: CreatePaymentLinkParams,
  ): Promise<CreatePaymentLinkResult> {
    const orderId = params.orderId?.trim();
    if (!orderId) {
      throw new BadRequestException('Order id is required');
    }

    const path = PRITHVI_API_PATHS.ORDER_PAYMENT_LINK.replace(
      ':orderId',
      encodeURIComponent(orderId),
    );
    const requestBody = {
      redirectUrl: this.resolvePaymentRedirectUrl(params.redirectUrl),
    };

    if (!this.isActive) {
      return this.dryRunCreatePaymentLink(orderId, requestBody);
    }

    const data = await this.requestJson<CreatePaymentLinkResult>({
      method: 'POST',
      callType: PrithviApiCallType.ORDER_PAYMENT_LINK,
      path,
      body: requestBody,
      params: null,
      clientErrorMessage:
        'Unable to generate payment link for this order. Please verify the order and try again.',
      serverErrorMessage:
        'Unable to generate payment link right now. Please try again later.',
    });

    return this.normalizePaymentLinkResult(data);
  }

  /**
   * Upload a KYC document to Prithvi for a draft order line.
   * POST /orders/:orderId/upload-document (multipart: document + documentType).
   */
  async uploadOrderDocument(
    params: UploadForexOrderDocumentParams,
  ): Promise<UploadForexOrderDocumentResult> {
    const orderId = params.orderId?.trim();
    const documentType = params.documentType?.trim();
    if (!orderId) {
      throw new BadRequestException('Order id is required');
    }
    if (!documentType) {
      throw new BadRequestException('documentType is required');
    }
    if (!params.buffer?.length) {
      throw new BadRequestException('Document file is required');
    }

    if (!this.isActive) {
      return this.dryRunUploadDocument(orderId, documentType);
    }

    const path = PRITHVI_API_PATHS.ORDER_UPLOAD_DOCUMENT.replace(
      ':orderId',
      encodeURIComponent(orderId),
    );
    const url = this.buildUrl(path);
    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let responseBody: Record<string, unknown> | null = null;
    let requestHeaders: Record<string, unknown> | null = null;
    let success = false;
    let errorMessage: string | null = null;

    const buildForm = () => {
      // Match Prithvi curl: multipart fields documentType + document (file).
      const form = new FormData();
      form.append('documentType', documentType);
      form.append('document', params.buffer, {
        filename: params.filename || `${documentType}.png`,
        contentType: params.mimeType || 'application/octet-stream',
        knownLength: params.buffer.length,
      });
      return form;
    };

    const buildHeaders = (token: string, form: FormData) => ({
      ...form.getHeaders(),
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    });

    try {
      let token = await this.prithvi.getValidAccessToken();
      let form = buildForm();
      requestHeaders = this.sanitizeHeaders(buildHeaders(token, form));
      let response = await axios.request({
        method: 'POST',
        url,
        data: form,
        headers: buildHeaders(token, form),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
      });

      if (this.isAuthTokenRejected(response.status, response.data)) {
        this.logger.warn(
          'Prithvi order upload-document received 401; refreshing OAuth token and retrying once.',
        );
        token = await this.prithvi.getValidAccessToken({ forceRefresh: true });
        form = buildForm();
        requestHeaders = this.sanitizeHeaders(buildHeaders(token, form));
        response = await axios.request({
          method: 'POST',
          url,
          data: form,
          headers: buildHeaders(token, form),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          validateStatus: () => true,
        });
      }

      httpStatus = response.status;
      responseBody = this.sanitizeObject(
        (response.data ?? {}) as Record<string, unknown>,
      );

      if (response.status >= 400 && response.status < 500) {
        errorMessage = `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
        const providerMessage = this.extractProviderMessage(response.data);
        throw new BadRequestException(
          providerMessage ??
            'Unable to upload document. Please check the file and try again.',
        );
      }

      if (response.status < 200 || response.status >= 300) {
        errorMessage = `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
        this.logger.error(
          `Prithvi order upload-document HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(
          'Unable to upload document to provider right now. Please try again later.',
        );
      }

      const envelope =
        response.data && typeof response.data === 'object'
          ? (response.data as Record<string, unknown>)
          : null;
      if (envelope && 'success' in envelope && envelope.success === false) {
        errorMessage = `API error: ${JSON.stringify(response.data)}`;
        const providerMessage = this.extractProviderMessage(response.data);
        throw new BadRequestException(
          providerMessage ??
            'Unable to upload document. Please check the file and try again.',
        );
      }

      const parsed = this.parseUploadDocumentResponse(
        response.data,
        documentType,
      );
      if (!parsed.prithviPath) {
        errorMessage = `Missing ${documentType} path in upload response`;
        throw new BadRequestException(
          `Provider did not return a path for ${documentType}.`,
        );
      }

      success = true;
      return parsed;
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
        `Prithvi order upload-document failed: ${errorMessage}`,
      );
      throw new InternalServerErrorException(
        'Unable to upload document to provider right now. Please try again later.',
      );
    } finally {
      void this.apiLog
        .create({
          callType: PrithviApiCallType.ORDER_UPLOAD_DOCUMENT,
          method: 'POST',
          url,
          requestBody: {
            documentType,
            filename: params.filename,
            mimeType: params.mimeType,
            size: params.buffer.length,
          },
          requestParams: null,
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

  /**
   * Build Prithvi complete order body.
   * Purpose answers may arrive nested under purposeAnswers (dynamic keys per purpose).
   * Documents are uploaded separately via upload-document — do not resend them.
   */
  private toPrithviCompleteOrder(
    order: CompleteForexOrderPayload,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(order)) {
      if (
        key === 'fieldValues' ||
        key === 'documents' ||
        key === 'confirmations' ||
        key === 'purposeAnswers'
      ) {
        continue;
      }
      if (value === undefined) continue;
      payload[key] = value;
    }

    const purposeAnswers = order.purposeAnswers;
    if (purposeAnswers && typeof purposeAnswers === 'object') {
      for (const [key, value] of Object.entries(purposeAnswers)) {
        if (value === undefined) continue;
        payload[key] = value;
      }
    }

    return payload;
  }

  private normalizeAgentCharges(
    raw: PrithviChargeLineRaw[] | null | undefined,
    params: GetAgentChargesParams,
    scope: string,
  ): PrithviAgentChargesResult {
    const allLines = Array.isArray(raw) ? raw : [];
    const inRangeLines = allLines.filter((line) => {
      const record = line as PrithviChargeLineRaw & Record<string, unknown>;
      return isChargeInRange(
        toOptionalNumber(firstDefined(line.min_amount, record.minAmount)),
        toOptionalNumber(firstDefined(line.max_amount, record.maxAmount)),
        params.inrAmount,
      );
    });
    const lines = inRangeLines.length > 0 ? inRangeLines : allLines;
    const items = lines.map((line) =>
      normalizeChargeLine(line, params.inrAmount),
    );

    let gst = 0;
    let serviceCharge = 0;
    let deliveryCharge = 0;
    let nostroCharge = 0;
    let prithiviCharge = 0;

    for (let i = 0; i < items.length; i += 1) {
      const key = resolveChargeFieldKey(lines[i]);
      const item = items[i];
      const isPercentage = String(item?.calculationType ?? '').toUpperCase() === 'PERCENTAGE';
      const amount =
        isPercentage && (item?.prithiviCharge ?? 0) > 0
          ? item.prithiviCharge
          : (item?.totalCharge ?? 0);
      if (isPercentage && (item?.prithiviCharge ?? 0) > 0) {
        prithiviCharge += item.prithiviCharge;
      }
      if (!key || !(amount > 0)) continue;
      if (key === 'gst') gst += amount;
      else if (key === 'serviceCharge') serviceCharge += amount;
      else if (key === 'deliveryCharge') deliveryCharge += amount;
      else if (key === 'nostroCharge') nostroCharge += amount;
    }

    const result: PrithviAgentChargesResult = {
      orderType: String(params.orderType).toUpperCase(),
      productType: String(params.productType).toUpperCase(),
      currencyCode: String(params.currencyCode).toUpperCase(),
      currencyAmount: params.currencyAmount,
      inrAmount: params.inrAmount,
      scope,
      items,
      gst,
      serviceCharge,
    };

    if (deliveryCharge > 0) result.deliveryCharge = deliveryCharge;
    if (nostroCharge > 0) result.nostroCharge = nostroCharge;
    if (prithiviCharge > 0) result.prithiviCharge = prithiviCharge;

    return result;
  }

  private dryRunAgentCharges(
    params: GetAgentChargesParams,
  ): PrithviAgentChargesResult {
    const scope = (params.scope ?? 'global').trim() || 'global';
    this.logger.warn(
      `PRITHVI_ACTIVE_MODE is not "true"; returning dry-run charges. orderType=${params.orderType} productType=${params.productType} currency=${params.currencyCode} amount=${params.currencyAmount}`,
    );

    const currencyCode = String(params.currencyCode).toUpperCase();
    const orderType = String(params.orderType).toUpperCase();
    const productType = String(params.productType).toUpperCase();
    const gstBase = Math.round(params.inrAmount * 0.0018 * 100) / 100;

    const raw: PrithviChargeLineRaw[] = [
      {
        component: 'BASE',
        source_scope: scope,
        charge_type: 'Service Charge',
        charge_code: 'SERVICE_CHARGE',
        order_type: orderType,
        product_type: productType,
        calculation_type: 'FIXED',
        calculation_value: '175.000000',
        currency_code: currencyCode,
        charge_name: 'Service Charge',
        prithiviCharge: 175,
        partnerCharge: 0,
        totalCharge: 175,
      },
      {
        component: 'BASE',
        source_scope: scope,
        charge_type: 'GST',
        charge_code: 'GST',
        order_type: orderType,
        product_type: productType,
        calculation_type: 'PERCENTAGE',
        calculation_value: '0.180000',
        additional_charge: null,
        max_cap: null,
        currency_code: currencyCode,
        charge_name: 'GST',
        prithiviCharge: gstBase,
        partnerCharge: 0,
        totalCharge: gstBase,
      },
    ];

    return this.normalizeAgentCharges(raw, params, scope);
  }

  private parseUploadDocumentResponse(
    raw: unknown,
    documentType: string,
  ): UploadForexOrderDocumentResult {
    // Live Prithvi shape:
    // { success: true, data: { forexOrder: { [documentType]: "path/..." } }, message }
    const root =
      raw && typeof raw === 'object'
        ? (raw as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const data =
      root.data && typeof root.data === 'object'
        ? (root.data as Record<string, unknown>)
        : root;

    const forexOrder =
      data.forexOrder && typeof data.forexOrder === 'object'
        ? (data.forexOrder as Record<string, unknown>)
        : root.forexOrder && typeof root.forexOrder === 'object'
          ? (root.forexOrder as Record<string, unknown>)
          : null;

    if (!forexOrder) {
      return { documentType, prithviPath: '', forexOrder: undefined };
    }

    const prithviPath =
      typeof forexOrder[documentType] === 'string'
        ? String(forexOrder[documentType]).trim()
        : '';

    return {
      documentType,
      prithviPath,
      forexOrder,
    };
  }

  private dryRunUploadDocument(
    orderId: string,
    documentType: string,
  ): UploadForexOrderDocumentResult {
    const prithviPath = `dry-run/${orderId}/${documentType.toLowerCase()}.png`;
    this.logger.warn(
      `PRITHVI_ACTIVE_MODE is not "true"; returning dry-run document upload. orderId=${orderId} documentType=${documentType}`,
    );
    return {
      documentType,
      prithviPath,
      forexOrder: {
        id: orderId,
        [documentType]: prithviPath,
      },
    };
  }

  /**
   * Paginate Prithvi dashboard and sync matching local orders by `prithviOrderId`.
   */
  async syncOrdersFromProvider(): Promise<SyncForexOrdersFromProviderResult> {
    const pageSize = 50;
    let page = 1;
    let pagesFetched = 0;
    let rowsSeen = 0;
    let rowsMatched = 0;
    let totalPages = 1;

    while (page <= totalPages) {
      const result = await this.getOrdersDashboard({
        pageNumber: page,
        pageSize,
      });
      pagesFetched += 1;
      rowsSeen += result.data.length;
      totalPages = Math.max(
        1,
        Math.ceil((result.meta.total || 0) / (result.meta.limit || pageSize)),
      );

      for (const row of result.data) {
        const synced = await this.forexOrders.syncFromDashboard({
          prithviOrderId: row.id,
          forexRequestId: row.forexRequestId ?? null,
          orderCode: row.orderCode ?? null,
          orderType: row.orderType ? String(row.orderType) : null,
          currency: row.currency ?? null,
          product: row.product ? String(row.product) : null,
          status: row.status,
          statusLabel: row.statusLabel ?? null,
          paymentStatus: row.paymentStatus ?? null,
          currencyAmount: row.currencyAmount ?? null,
          amountInINR: row.amountInINR ?? null,
          totalAmount: row.totalAmount ?? null,
          travelerName: row.travelerName ?? null,
          providerCreatedAt: row.createdAt ?? null,
          providerUpdatedAt: row.updatedAt ?? null,
        });
        if (synced.matched) rowsMatched += 1;
        if (synced.statusChanged && synced.createdByUserId) {
          await this.forexOrderNotifications.notifyIfStatusChanged({
            createdByUserId: synced.createdByUserId,
            previousStatus: synced.previousStatus ?? '',
            newStatus: synced.newStatus ?? '',
            statusLabel: synced.statusLabel,
            orderCode: synced.orderCode,
            prithviOrderId: synced.prithviOrderId,
          });
        }
      }

      if (result.data.length === 0) break;
      page += 1;
      if (pagesFetched > 100) {
        this.logger.warn(
          'Prithvi forex orders sync stopped after 100 pages as a safety cap.',
        );
        break;
      }
    }

    this.logger.log(
      `Prithvi forex orders sync finished: pages=${pagesFetched} seen=${rowsSeen} matched=${rowsMatched}`,
    );

    return { pagesFetched, rowsSeen, rowsMatched };
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
   * Served from MongoDB cache (refreshed monthly); never hits Prithvi on each request.
   */
  async listPurposes(params: GetPurposesParams = {}): Promise<PrithviPurpose[]> {
    const cached = await this.purposeCache.findLatest();
    const purposes =
      cached?.purposes?.length
        ? cached.purposes
        : await this.syncPurposesFromProvider();

    return this.filterPurposes(purposes, params);
  }

  /**
   * Fetch the full purpose catalogue from Prithvi and persist it.
   * Used by monthly cron and on first request when the cache is empty.
   */
  async syncPurposesFromProvider(): Promise<PrithviPurpose[]> {
    const purposes = this.isActive
      ? await this.fetchLivePurposes()
      : this.dryRunPurposes();

    await this.purposeCache.upsert({
      purposes,
      isDryRun: !this.isActive,
    });

    this.logger.log(
      `Prithvi purpose list synced (${purposes.length} purposes, dryRun=${!this.isActive}).`,
    );
    return purposes;
  }

  private async fetchLivePurposes(): Promise<PrithviPurpose[]> {
    const raw = await this.requestJson<PrithviPurpose[]>({
      method: 'GET',
      callType: PrithviApiCallType.PURPOSE_LIST,
      path: PRITHVI_API_PATHS.PURPOSE_LIST,
      body: null,
      params: null,
      clientErrorMessage: 'Unable to load purposes. Please try again.',
      serverErrorMessage:
        'Unable to load purposes right now. Please try again later.',
    });

    return this.normalizePurposes(raw);
  }

  private normalizePurposes(raw: PrithviPurpose[]): PrithviPurpose[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((item) => item && typeof item.code === 'string' && item.code)
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        description: item.description,
        category: item.category,
        orderType: item.orderType,
        productType: item.productType,
        isActive: item.isActive !== false,
      }));
  }

  private filterPurposes(
    purposes: PrithviPurpose[],
    params: GetPurposesParams,
  ): PrithviPurpose[] {
    const orderType = params.orderType
      ? String(params.orderType).toUpperCase()
      : undefined;
    const productType = params.productType
      ? String(params.productType).toUpperCase()
      : undefined;

    return purposes.filter((purpose) => {
      if (purpose.isActive === false) {
        return false;
      }
      if (
        orderType &&
        purpose.orderType &&
        String(purpose.orderType).toUpperCase() !== orderType
      ) {
        return false;
      }
      if (
        productType &&
        purpose.productType &&
        String(purpose.productType).toUpperCase() !== productType
      ) {
        return false;
      }
      return true;
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
    const forexRequest = result?.forexRequest as
      | (InitiateForexRequestResult['forexRequest'] & {
          orders?: InitiateForexRequestResult['orders'];
          created_at?: string;
        })
      | undefined;
    const nestedOrders = result?.orders ?? forexRequest?.orders ?? [];

    if (!forexRequest) {
      return result;
    }

    return {
      forexRequest: {
        id: forexRequest.id,
        sessionId: forexRequest.sessionId,
        status: forexRequest.status,
        sessionExpiresAt: forexRequest.sessionExpiresAt,
        orderType: forexRequest.orderType,
        createdAt: forexRequest.createdAt ?? forexRequest.created_at,
      },
      orders: nestedOrders.map((order) => ({
        id: order.id,
        forexRequestId: order.forexRequestId ?? forexRequest.id,
        orderCode: order.orderCode,
        currency: order.currency,
        product: order.product,
        currencyAmount: order.currencyAmount,
        amountInINR: order.amountInINR,
        sellingRate: order.sellingRate,
        agentSellingRate: order.agentSellingRate,
        gst: order.gst,
        serviceCharge: order.serviceCharge,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        status: order.status,
        created_at: order.created_at,
        createdAt: order.createdAt ?? order.created_at,
      })),
    };
  }

  private normalizeCompleteResult(
    result: CompleteForexRequestResult,
  ): CompleteForexRequestResult {
    const forexRequest = result?.forexRequest as
      | (CompleteForexRequestResult['forexRequest'] & {
          orders?: CompleteForexOrderSnapshot[];
        })
      | undefined;

    if (!forexRequest) {
      return result;
    }

    const nestedOrders = result?.orders ?? forexRequest.orders ?? [];

    return {
      forexRequest: {
        id: forexRequest.id,
        status: forexRequest.status,
        updated_at: forexRequest.updated_at,
        updatedAt: forexRequest.updatedAt ?? forexRequest.updated_at,
      },
      orders: nestedOrders.map((order) => ({
        ...order,
        id: order.id,
        forexRequestId: order.forexRequestId ?? forexRequest.id,
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

  private resolvePaymentRedirectUrl(override?: string): string {
    const configured =
      override?.trim() ||
      this.config.get('PRITHVI_PAYMENT_REDIRECT_URL')?.trim();
    return configured || PRITHVI_DEFAULT_PAYMENT_REDIRECT_URL;
  }

  private dryRunCreatePaymentLink(
    orderId: string,
    requestBody: { redirectUrl: string },
  ): CreatePaymentLinkResult {
    this.logger.warn(
      `PRITHVI_ACTIVE_MODE is not "true"; returning dry-run payment link. orderId=${orderId}`,
    );

    const token = `dry_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const result: CreatePaymentLinkResult = {
      paymentLink: `/payment/?token=${token}`,
      paymentLinkFull: `http://lead-application-stage.s3-website.ap-south-1.amazonaws.com/payment/?token=${token}`,
      token,
    };

    void this.apiLog
      .create({
        callType: PrithviApiCallType.ORDER_PAYMENT_LINK,
        method: 'POST',
        url: this.buildUrl(
          PRITHVI_API_PATHS.ORDER_PAYMENT_LINK.replace(
            ':orderId',
            encodeURIComponent(orderId),
          ),
        ),
        requestBody,
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

  private normalizePaymentLinkResult(
    data: CreatePaymentLinkResult | Record<string, unknown>,
  ): CreatePaymentLinkResult {
    const record = (data ?? {}) as Record<string, unknown>;
    const paymentLink =
      typeof record.paymentLink === 'string' ? record.paymentLink : '';
    const paymentLinkFull =
      typeof record.paymentLinkFull === 'string'
        ? record.paymentLinkFull
        : '';
    const token = typeof record.token === 'string' ? record.token : '';

    if (!paymentLinkFull && !paymentLink) {
      throw new BadRequestException(
        'Payment link was not returned by the provider. Please try again.',
      );
    }

    return {
      paymentLink,
      paymentLinkFull: paymentLinkFull || paymentLink,
      token,
    };
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
        orderCode: 'DRY-PENDING-001',
        status: PrithviForexRequestStatus.PENDING,
        statusLabel: 'Pending Approval',
        orderType: PrithviOrderType.BUY,
        currency: 'USD',
        product: PrithviProductType.CASH,
        currencyAmount: '1000',
        amountInINR: '85000',
        totalAmount: '85000',
        paymentStatus: 'NOT_PAID',
        travelerName: 'Dry Run Traveler',
        createdAt: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440099',
        orderCode: 'DRY-APPROVED-099',
        status: PrithviForexRequestStatus.APPROVED,
        statusLabel: 'Approved',
        orderType: PrithviOrderType.BUY,
        currency: 'EUR',
        product: PrithviProductType.TT,
        currencyAmount: '500',
        amountInINR: '45000',
        totalAmount: '45000',
        paymentStatus: 'PAID',
        travelerName: 'Dry Run Traveler',
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
        category: 'travel',
        orderType: PrithviOrderType.BUY,
        productType: PrithviProductType.CASH,
        isActive: true,
      },
      {
        code: 'S0002',
        name: 'Business Travel',
        description: 'Overseas travel for business meetings',
        category: 'business',
        orderType: PrithviOrderType.BUY,
        productType: PrithviProductType.CASH,
        isActive: true,
      },
      {
        code: 'S0003',
        name: 'Medical Treatment Abroad',
        description: 'Medical treatment and related expenses overseas',
        category: 'medical',
        orderType: PrithviOrderType.BUY,
        productType: PrithviProductType.TT,
        isActive: true,
      },
      {
        code: 'S0004',
        name: 'Education / Studies Abroad',
        description: 'Tuition and living expenses for overseas education',
        category: 'education',
        orderType: PrithviOrderType.BUY,
        productType: PrithviProductType.CARD,
        isActive: true,
      },
      {
        code: 'S0501',
        name: 'Sell Cash',
        description: 'Sell leftover foreign currency cash',
        category: 'sell',
        orderType: PrithviOrderType.SELL,
        productType: PrithviProductType.CASH,
        isActive: true,
      },
    ];
  }

  private dryRunPurposeConfig(code: string): PrithviPurposeConfig {
    const purposes = this.dryRunPurposes();
    const match = purposes.find((p) => p.code === code) ?? purposes[0];

    return {
      id: `dry-run-purpose-${match.code}`,
      code: match.code,
      name: match.name,
      description: match.description,
      category: match.category,
      orderType: match.orderType,
      productType: match.productType,
      isActive: true,
      requiredFields: [
        {
          id: 'dry-passport-file',
          fieldKey: 'passportfilenumber',
          fieldLabel: 'Passport File Number',
          fieldType: 'text',
          isRequired: true,
          validationRules: {
            regex: '^[A-Za-z0-9]{6,20}$',
            minLength: 6,
            maxLength: 20,
          },
          displayOrder: 2,
          isActive: true,
        },
        {
          id: 'dry-dob',
          fieldKey: 'dateofbirth',
          fieldLabel: 'Date of Birth',
          fieldType: 'date',
          isRequired: true,
          validationRules: {},
          displayOrder: 3,
          isActive: true,
        },
        {
          id: 'dry-passport-number',
          fieldKey: 'passportNumber',
          fieldLabel: 'Passport Number',
          fieldType: 'text',
          isRequired: true,
          validationRules: { regex: '^[A-Z0-9]{6,9}$' },
          displayOrder: 4,
          isActive: true,
        },
        {
          id: 'dry-payment',
          fieldKey: 'preferredPaymentMode',
          fieldLabel: 'Preferred Mode of Payment',
          fieldType: 'radio',
          isRequired: true,
          validationRules: {
            icons: {
              UPI: 'Smartphone',
              Cash: 'Banknote',
              Cheque: 'FileText',
              'Debit Card': 'CreditCard',
              'Net Banking': 'Globe',
            },
            allowed: ['Cash', 'UPI', 'Net Banking', 'Debit Card', 'Cheque'],
          },
          displayOrder: 100,
          isActive: true,
        },
        {
          id: 'dry-delivery',
          fieldKey: 'preferredDeliveryMode',
          fieldLabel: 'Preferred Mode of Delivery',
          fieldType: 'radio',
          isRequired: true,
          validationRules: {
            icons: {
              'Home Delivery': 'Home',
              'Collect at Branch': 'Store',
              'Express Home Delivery @ 250 Rs': 'Zap',
            },
            allowed: [
              'Collect at Branch',
              'Home Delivery',
              'Express Home Delivery @ 250 Rs',
            ],
          },
          displayOrder: 101,
          isActive: true,
        },
        {
          id: 'dry-confirmations',
          fieldKey: 'confirmations',
          fieldLabel: 'Confirmations',
          fieldType: 'confirmCheckbox',
          isRequired: true,
          validationRules: {
            labels: {
              visaConfirmation:
                'Click here if you don’t need a visa or will get one when you arrive.',
              selfCollectionConfirm:
                'I confirm I will be there in person to pick up the order when it’s delivered.',
              currencyDeclarationConfirm:
                'I confirm I have all valid documents and haven’t bought or transferred more than USD 250,000 in foreign currency in this financial year.',
            },
            allowed: [
              'visaConfirmation',
              'currencyDeclarationConfirm',
              'selfCollectionConfirm',
            ],
          },
          displayOrder: 200,
          isActive: true,
        },
      ],
      requiredDocuments: [
        {
          id: 'dry-passport-front',
          documentType: 'passportFrontImage',
          documentLabel: 'Passport Front',
          isMandatory: true,
          allowedFormats: 'pdf,jpg,png',
          maxFileSizeMb: 5,
          isActive: true,
        },
        {
          id: 'dry-passport-back',
          documentType: 'passportBackImage',
          documentLabel: 'Passport Back',
          isMandatory: true,
          allowedFormats: 'pdf,jpg,png',
          maxFileSizeMb: 5,
          isActive: true,
        },
        {
          id: 'dry-air-ticket',
          documentType: 'airTicket',
          documentLabel: 'Air Ticket',
          isMandatory: true,
          allowedFormats: 'pdf,jpg,png',
          maxFileSizeMb: 5,
          isActive: true,
        },
        {
          id: 'dry-visa',
          documentType: 'visaImage',
          documentLabel: 'Visa',
          isMandatory: true,
          allowedFormats: 'pdf,jpg,png',
          maxFileSizeMb: 5,
          isActive: true,
        },
        {
          id: 'dry-pan',
          documentType: 'panCardImage',
          documentLabel: 'PAN Card',
          isMandatory: true,
          allowedFormats: 'pdf,jpg,png',
          maxFileSizeMb: 5,
          isActive: true,
        },
      ],
      documentsRequired: ['Passport', 'Visa', 'Air Ticket'],
      allowedProducts: [
        PrithviProductType.CASH,
        PrithviProductType.CARD,
        PrithviProductType.TT,
      ],
    };
  }

  /**
   * Prithvi returns `{ orders, pagination }` inside `data`. Older / alternate
   * shapes use a bare array or `{ data, meta }`. Always map rows so status is
   * the human code (PENDING) rather than a UUID, and dates use `createdAt`.
   */
  private normalizeDashboardResponse(
    envelope: PrithviApiResponse<unknown> & {
      meta?: PrithviForexOrdersDashboardResult['meta'];
    },
  ): PrithviForexOrdersDashboardResult {
    const data = envelope.data;
    const meta = envelope.meta;
    const defaultMeta = (total: number, page = 1, limit = 10) =>
      meta ?? { total, page, limit };

    // Live Prithvi shape: { success, data: { orders, pagination } }
    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as { orders?: unknown }).orders)
    ) {
      const payload = data as {
        orders: unknown[];
        pagination?: {
          page?: number;
          limit?: number;
          total?: number;
        };
      };
      const orders = payload.orders.map((row) => this.normalizeDashboardOrder(row));
      const pagination = payload.pagination;
      return {
        data: orders,
        meta: {
          total: pagination?.total ?? orders.length,
          page: pagination?.page ?? 1,
          limit: pagination?.limit ?? 10,
        },
      };
    }

    if (Array.isArray(data) && meta) {
      return {
        data: data.map((row) => this.normalizeDashboardOrder(row)),
        meta,
      };
    }

    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as { data?: unknown }).data)
    ) {
      const nested = data as {
        data: unknown[];
        meta?: PrithviForexOrdersDashboardResult['meta'];
      };
      const orders = nested.data.map((row) => this.normalizeDashboardOrder(row));
      return {
        data: orders,
        meta:
          nested.meta ??
          meta ?? { total: orders.length, page: 1, limit: 10 },
      };
    }

    if (Array.isArray(data)) {
      const orders = data.map((row) => this.normalizeDashboardOrder(row));
      return {
        data: orders,
        meta: defaultMeta(orders.length, 1, orders.length || 10),
      };
    }

    return { data: [], meta: defaultMeta(0) };
  }

  private normalizeDashboardOrder(row: unknown): PrithviForexOrdersDashboardResult['data'][number] {
    const o =
      row && typeof row === 'object'
        ? (row as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const tx =
      o.transactionStatus && typeof o.transactionStatus === 'object'
        ? (o.transactionStatus as Record<string, unknown>)
        : undefined;

    const statusFromTx =
      (typeof tx?.code === 'string' && tx.code) ||
      (typeof tx?.customerCode === 'string' && tx.customerCode) ||
      undefined;

    const rawStatus = typeof o.status === 'string' ? o.status : undefined;
    // Prefer transactionStatus.code; fall back to status only when it looks
    // like a code (not a UUID).
    const statusLooksLikeUuid =
      !!rawStatus &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rawStatus,
      );

    return {
      id: typeof o.id === 'string' ? o.id : String(o.id ?? ''),
      forexRequestId:
        typeof o.forexRequestId === 'string' ? o.forexRequestId : undefined,
      orderCode: typeof o.orderCode === 'string' ? o.orderCode : undefined,
      orderType: typeof o.orderType === 'string' ? o.orderType : undefined,
      currency: typeof o.currency === 'string' ? o.currency : undefined,
      product: typeof o.product === 'string' ? o.product : undefined,
      status:
        statusFromTx ??
        (!statusLooksLikeUuid && rawStatus ? rawStatus : 'UNKNOWN'),
      statusLabel: typeof tx?.label === 'string' ? tx.label : undefined,
      paymentStatus:
        typeof o.paymentStatus === 'string' ? o.paymentStatus : undefined,
      currencyAmount:
        o.currencyAmount != null ? (o.currencyAmount as string | number) : undefined,
      amountInINR:
        o.amountInINR != null ? (o.amountInINR as string | number) : undefined,
      totalAmount:
        o.totalAmount != null ? (o.totalAmount as string | number) : undefined,
      travelerName:
        typeof o.travelerName === 'string' ? o.travelerName : undefined,
      createdAt:
        (typeof o.createdAt === 'string' && o.createdAt) ||
        (typeof o.created_at === 'string' && o.created_at) ||
        undefined,
      updatedAt:
        (typeof o.updatedAt === 'string' && o.updatedAt) ||
        (typeof o.updated_at === 'string' && o.updated_at) ||
        undefined,
    };
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

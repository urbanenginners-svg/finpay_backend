export enum PrithviApiCallType {
  OAUTH_TOKEN = 'oauth_token',
  OAUTH_REFRESH = 'oauth_refresh',
  OAUTH_INTROSPECT = 'oauth_introspect',
  OAUTH_REVOKE = 'oauth_revoke',
  AGENT_RATES = 'agent_rates',
  PASSPORT_VERIFY = 'passport_verify',
  PAN_VERIFY = 'pan_verify',
  FOREX_INITIATE = 'forex_initiate',
  FOREX_COMPLETE = 'forex_complete',
  FOREX_ORDERS_DASHBOARD = 'forex_orders_dashboard',
  ORDER_UPLOAD_DOCUMENT = 'order_upload_document',
  PAYMENTS_ORDER_CREATE = 'payments_order_create',
  PURPOSE_LIST = 'purpose_list',
  PURPOSE_CONFIG = 'purpose_config',
}

export enum PrithviForexRequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
}

export enum PrithviOrderType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum PrithviProductType {
  CASH = 'CASH',
  CARD = 'CARD',
  TT = 'TT',
}

export type PrithviApiResponse<T> = {
  success: boolean;
  code: number;
  message?: string;
  data: T;
  timestamp?: string;
  metadata?: {
    source?: string;
  };
};

export type PrithviOAuthTokenData = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type PrithviTokenIntrospectionData = {
  active: boolean;
  sub?: string;
  scope?: string;
  exp?: number;
};

export type PrithviBuyRateKeys = 'bpc' | 'btt' | 'bdd' | 'bcn' | 'ncn_combo';
export type PrithviSellRateKeys = 'scn' | 'spc';

export type PrithviBuyRates = Record<PrithviBuyRateKeys, number>;
export type PrithviSellRates = Record<PrithviSellRateKeys, number>;

/** Single currency entry in the Prithvi agent rates API response. */
export type PrithviAgentRateRawEntry = {
  currency_code: string;
  currency_name: string;
  rates: {
    buy: PrithviBuyRates;
    sell: PrithviSellRates;
  };
  gst_percentage: string;
  timestamp: string;
};

/** Raw `data` object keyed by currency code (USD, CHF, …). */
export type PrithviAgentRatesRawData = Record<string, PrithviAgentRateRawEntry>;

export type PrithviAgentCurrencyRate = {
  currencyCode: string;
  currencyName: string;
  gstPercentage: string;
  timestamp: string;
  rates: {
    buy: PrithviBuyRates;
    sell: PrithviSellRates;
  };
};

export type PrithviAgentRatesResult = {
  message?: string;
  source?: string;
  timestamp: string;
  currencies: PrithviAgentCurrencyRate[];
};

/** Rates served from the MongoDB cache (or freshly synced on cache miss). */
export type CachedPrithviAgentRatesResult = PrithviAgentRatesResult & {
  fetchedAt: string;
  fromCache: boolean;
};

/** @deprecated Use PrithviAgentRatesResult — kept for backward-compatible single-rate consumers. */
export type PrithviAgentRateData = {
  currency: string;
  rate: number;
  timestamp: string;
};

export type GetAgentRatesParams = {
  orderType: PrithviOrderType;
  productType: PrithviProductType;
  agentId?: string;
};

export type VerifyPassportParams = {
  fileNumber: string;
  name: string;
  dob: string;
};

export type PrithviPassportVerificationData = {
  passport_number: string;
  name: string;
  status: string;
};

export type VerifyPanNumberParams = {
  panNumber: string;
  name: string;
};

export type PrithviPanVerificationData = {
  panNumber: string;
  name: string;
  status: string;
  registered_name?: string;
};

export type PrithviForexOrderDetail = {
  currency: string;
  product: PrithviProductType;
  currencyAmount: number;
  amountInINR: number;
  sellingRate: number;
  agentSellingRate: number;
  gst: number;
  serviceCharge: number;
};

export type InitiateForexRequestParams = {
  orderType: PrithviOrderType;
  orderDetails: PrithviForexOrderDetail[];
};

export type PrithviForexDraftOrder = {
  id: string;
  forexRequestId?: string;
  orderCode?: string;
  currency?: string;
  product?: PrithviProductType | string;
  currencyAmount?: string | number;
  amountInINR?: string | number;
  sellingRate?: string | number | null;
  agentSellingRate?: string | number | null;
  gst?: string | number;
  serviceCharge?: string | number;
  totalAmount?: string | number;
  paymentStatus?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

export type PrithviForexRequestSummary = {
  id: string;
  sessionId?: string;
  status: PrithviForexRequestStatus | string;
  sessionExpiresAt?: string;
  orderType?: PrithviOrderType | string;
  createdAt?: string;
};

export type InitiateForexRequestResult = {
  forexRequest: PrithviForexRequestSummary;
  orders?: PrithviForexDraftOrder[];
};

export type CompleteForexOrderPayload = {
  orderId: string;
  travelerName: string;
  phoneNumber: string;
  email: string;
  purpose: string;
  travelingCountries: string[];
  sellingRate: number;
  serviceCharge: number;
  gst: number;
  panNumber?: string;
  deliveryAddress?: string;
  pincode?: string;
  sourceOfFunds?: string;
  preferredDeliveryMode?: string;
  preferredPaymentMode?: string;
  /** Travelling start date from the booking form. */
  startDate?: string;
  /** Travelling end date from the booking form (optional). */
  endDate?: string;
  /** Local Finpay beneficiary id (TT). */
  beneficiaryId?: string;
  institutionName?: string;
  institutionAddress?: string;
  swiftCode?: string;
  routingNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  beneficiaryBankAddress?: string;
  additionalInfo?: string;
  interimBankName?: string;
  interimBankAddress?: string;
  interimBankCode?: string;
  interimBankCountry?: string;
  benCountry?: string;
  beneficiaryRelation?: string;
  isInterimBankSelected?: boolean;
  /**
   * Purpose-config dynamic answers. Flattened onto the Prithvi payload.
   * Keys vary by purpose (e.g. correspondentBankCharges, asPerDoc).
   */
  purposeAnswers?: Record<string, string | boolean | number | null>;
  passportNumber?: string;
  passportfilenumber?: string;
  dateofbirth?: string;
  businessName?: string;
  visaConfirmation?: boolean;
  selfCollectionConfirm?: boolean;
  currencyDeclarationConfirm?: boolean;
};

export type UploadForexOrderDocumentParams = {
  orderId: string;
  documentType: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

export type UploadForexOrderDocumentResult = {
  documentType: string;
  prithviPath: string;
  forexOrder?: Record<string, unknown>;
};

export type CreatePaymentOrderParams = {
  orderId: string;
  orderAmount: number;
  currency?: string;
  paymentMethod?: string;
  paymentMode?: string;
};

/**
 * Prithvi payment create response varies by gateway; keep as a loose object
 * and let the client pick checkout / redirect fields when present.
 */
export type CreatePaymentOrderResult = Record<string, unknown>;

export type CompleteForexRequestParams = {
  forexRequestId: string;
  orders: CompleteForexOrderPayload[];
};

export type CompleteForexOrderSnapshot = {
  id: string;
  forexRequestId?: string;
  orderCode?: string;
  orderType?: string;
  currency?: string;
  product?: PrithviProductType | string;
  status?: string;
  paymentStatus?: string;
  currencyAmount?: string | number;
  amountInINR?: string | number;
  sellingRate?: string | number;
  agentSellingRate?: string | number;
  gst?: string | number;
  serviceCharge?: string | number;
  totalAmount?: string | number;
  paidAmount?: string | number;
  pendingAmount?: string | number;
  travelerName?: string;
  phoneNumber?: string;
  email?: string;
  panNumber?: string;
  purpose?: string;
  travelingCountries?: string[];
  deliveryAddress?: string;
  pincode?: string;
  sourceOfFunds?: string;
  preferredDeliveryMode?: string;
  preferredPaymentMode?: string;
  startDate?: string;
  endDate?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CompleteForexRequestResult = {
  forexRequest: {
    id: string;
    status: PrithviForexRequestStatus | string;
    updated_at?: string;
    updatedAt?: string;
  };
  orders?: CompleteForexOrderSnapshot[];
};

export type GetForexOrdersDashboardParams = {
  pageNumber?: number;
  pageSize?: number;
  status?: PrithviForexRequestStatus | string;
  product?: PrithviProductType | string;
  fromDate?: string;
  toDate?: string;
};

/** Normalized row for the agent forex orders dashboard. */
export type PrithviForexDashboardOrder = {
  id: string;
  forexRequestId?: string;
  orderCode?: string;
  orderType?: PrithviOrderType | string;
  currency?: string;
  product?: PrithviProductType | string;
  /** Status code (DRAFT / PENDING / APPROVED / …), not the Prithvi UUID. */
  status: PrithviForexRequestStatus | string;
  statusLabel?: string;
  paymentStatus?: string;
  currencyAmount?: string | number;
  amountInINR?: string | number;
  totalAmount?: string | number;
  travelerName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SyncForexOrdersFromProviderResult = {
  pagesFetched: number;
  rowsSeen: number;
  rowsMatched: number;
};

export type PrithviForexOrdersDashboardResult = {
  data: PrithviForexDashboardOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
};

export type GetPurposesParams = {
  orderType?: PrithviOrderType | string;
  productType?: PrithviProductType | string;
};

export type PrithviPurpose = {
  id?: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  orderType?: PrithviOrderType | string;
  productType?: PrithviProductType | string;
  isActive?: boolean;
};

export type PrithviPurposeFieldValidationRules = {
  regex?: string;
  minLength?: number;
  maxLength?: number;
  allowed?: string[];
  labels?: Record<string, string>;
  icons?: Record<string, string>;
};

export type PrithviPurposeRequiredField = {
  id: string;
  purposeCodeId?: string;
  fieldKey: string;
  fieldLabel: string;
  applicableUserTypes?: string[];
  fieldType: string;
  isRequired: boolean;
  validationRules?: PrithviPurposeFieldValidationRules | null;
  displayOrder?: number;
  isActive?: boolean;
  isDelete?: boolean;
};

export type PrithviPurposeRequiredDocument = {
  id: string;
  purposeCodeId?: string;
  documentType: string;
  documentLabel: string;
  applicableUserTypes?: string[];
  isMandatory: boolean;
  allowedFormats?: string;
  maxFileSizeMb?: number;
  isActive?: boolean;
  isDelete?: boolean;
};

export type PrithviPurposeConfig = {
  id?: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  orderType?: PrithviOrderType | string;
  productType?: PrithviProductType | string;
  isActive?: boolean;
  requiredFields?: PrithviPurposeRequiredField[];
  requiredDocuments?: PrithviPurposeRequiredDocument[];
  /** @deprecated Prefer requiredDocuments from live purpose config */
  documentsRequired?: string[];
  allowedProducts?: Array<PrithviProductType | string>;
};

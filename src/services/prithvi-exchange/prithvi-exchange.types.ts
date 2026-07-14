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
  currency?: string;
  product?: PrithviProductType;
  currencyAmount?: number;
  amountInINR?: number;
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
  panNumber: string;
  purpose: string;
  travelingCountries: string[];
  deliveryAddress: string;
  pincode: string;
  sourceOfFunds: string;
  preferredDeliveryMode: string;
  preferredPaymentMode: string;
};

export type CompleteForexRequestParams = {
  forexRequestId: string;
  orders: CompleteForexOrderPayload[];
};

export type CompleteForexRequestResult = {
  forexRequest: {
    id: string;
    status: PrithviForexRequestStatus | string;
  };
};

export type GetForexOrdersDashboardParams = {
  pageNumber?: number;
  pageSize?: number;
  status?: PrithviForexRequestStatus | string;
  product?: PrithviProductType | string;
  fromDate?: string;
  toDate?: string;
};

export type PrithviForexOrdersDashboardResult = {
  data: PrithviForexRequestSummary[];
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
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
};

export type PrithviPurposeConfig = {
  code: string;
  name: string;
  documentsRequired: string[];
  allowedProducts: Array<PrithviProductType | string>;
};

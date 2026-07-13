export enum PrithviApiCallType {
  OAUTH_TOKEN = 'oauth_token',
  OAUTH_REFRESH = 'oauth_refresh',
  OAUTH_INTROSPECT = 'oauth_introspect',
  OAUTH_REVOKE = 'oauth_revoke',
  AGENT_RATES = 'agent_rates',
  PASSPORT_VERIFY = 'passport_verify',
  PAN_VERIFY = 'pan_verify',
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

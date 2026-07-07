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

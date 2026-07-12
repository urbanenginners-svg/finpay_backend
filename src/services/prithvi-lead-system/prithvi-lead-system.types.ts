export enum PrithviLeadSystemApiCallType {
  OAUTH_TOKEN = 'oauth_token',
  OAUTH_REFRESH = 'oauth_refresh',
  OAUTH_INTROSPECT = 'oauth_introspect',
  OAUTH_REVOKE = 'oauth_revoke',
  PASSPORT_VERIFY = 'passport_verify',
  PAN_VERIFY = 'pan_verify',
}

export type PrithviLeadSystemApiResponse<T> = {
  success: boolean;
  code: number;
  message?: string;
  data: T;
  timestamp?: string;
};

/** Middle wrapper returned by PAN / passport verification endpoints. */
export type PrithviLeadSystemVerificationEnvelope<T> = {
  success: boolean;
  data: T;
  verificationId: number;
  source: string;
  timestamp?: string;
};

export type PrithviLeadSystemPanInnerResult = {
  success: boolean;
  name_provided: string;
  registered_name: string;
};

export type PrithviLeadSystemPassportInnerResult = {
  success: boolean;
  name_provided?: string;
  passport_number?: string;
  registered_name?: string;
};

export type PrithviLeadSystemPanVerificationData = {
  success: boolean;
  verificationId: number | string;
  name_provided: string;
  registered_name: string;
  source?: string;
};

export type PrithviLeadSystemPassportVerificationData = {
  success: boolean;
  verificationId: number | string;
  name_provided: string;
  passport_number: string;
  registered_name?: string;
  source?: string;
};

export type PrithviLeadSystemOAuthTokenData = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type PrithviLeadSystemTokenIntrospectionData = {
  active: boolean;
  sub?: string;
  scope?: string;
  exp?: number;
};

export type VerifyPassportParams = {
  fileNumber: string;
  name: string;
  dob: string;
};

export type VerifyPanNumberParams = {
  panNumber: string;
  name: string;
};

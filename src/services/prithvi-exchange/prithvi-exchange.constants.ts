export const PRITHVI_API_PATHS = {
  OAUTH_TOKEN: '/auth/oauth/token',
  OAUTH_REFRESH: '/auth/oauth/refresh',
  OAUTH_INTROSPECT: '/auth/oauth/introspect',
  OAUTH_REVOKE: '/auth/oauth/revoke',
  AGENT_RATES: '/rates/agents',
  /** Agent charge schedule (FIXED / PERCENTAGE line items). */
  AGENT_CHARGES: '/agents/charges',
  PASSPORT_VERIFY: '/verification/passport',
  PAN_VERIFY: '/verification/pan-number',
  FOREX_INITIATE: '/forex/initiate',
  FOREX_COMPLETE: '/forex/:id/complete',
  FOREX_ORDERS_DASHBOARD: '/forex/orders/dashboard',
  ORDER_UPLOAD_DOCUMENT: '/orders/:orderId/upload-document',
  ORDER_PAYMENT_LINK: '/orders/:orderId/payment-link',
  ORDER_OFFLINE_PAYMENT: '/orders/:orderId/offline-payment',
  ORDER_UPLOAD_PAYMENT_RECEIPT: '/orders/:orderId/upload-payment-receipt',
  PURPOSE_LIST: '/purpose',
  PURPOSE_CONFIG: '/purpose/:code/config',
} as const;

/** Post-payment return URL sent to Prithvi POST /orders/:orderId/payment-link. */
export const PRITHVI_DEFAULT_PAYMENT_REDIRECT_URL =
  'https://finpayremit.com/dashboard/forex/orders';

/** Draft forex rate lock window from Prithvi (Step 1 → Step 2). */
export const PRITHVI_FOREX_DRAFT_TTL_MS = 20 * 60 * 1000;

export const PRITHVI_DEFAULT_SCOPE = 'read write';

/** Refresh access token when less than this many ms remain before expiry. */
export const PRITHVI_TOKEN_REFRESH_BUFFER_MS = 60 * 60 * 1000;

export const PRITHVI_PROVIDER_NAME = 'prithvi';

/** Agent rates sync schedule: every 5 minutes. */
export const PRITHVI_AGENT_RATES_CRON = '*/5 * * * *';
export const PRITHVI_AGENT_RATES_CRON_TIMEZONE = 'Asia/Kolkata';

/**
 * Display labels keyed by Prithvi purpose code. Prithvi may rename purposes
 * (e.g. appending "AD1"/"AD2"); codes stay stable, so the UI label comes from
 * here. Purposes whose code is missing fall back to the Prithvi name.
 */
export const PRITHVI_PURPOSE_LABELS: Readonly<Record<string, string>> = {
  S0001: 'Leisure/Private Visit/Holiday',
  S0011: 'Leisure/Private Visit/Holiday',
  S0101: 'Business Visit',
  S0111: 'Business Visit',
  S0301: 'Education Abroad',
  S0311: 'Education Abroad',
  S0401: 'Employment Abroad',
  S0411: 'Employment Abroad',
  S0501: 'Sell Cash',
  S0502: 'Sell Card',
  S0305: 'Transfer to Educational Institute',
  S0306: 'Transfer to Educational Institute (Loan)',
  S1107: 'Transfer to Education Individual Account',
  S0402: 'Medical Treatment Abroad',
  S0403: 'Emigration',
  S0901: 'Tour',
  S0902: 'MICE',
  S0903: 'Private Visit',
  S1301: 'Transfer to Family Member Abroad',
  S1302: 'Transfer to Non Relative Individual (Gift)',
};

/** Purpose list sync: 1st of each month at 2:00 AM IST. */
export const PRITHVI_PURPOSE_LIST_CRON = '0 2 1 * *';
export const PRITHVI_PURPOSE_LIST_CRON_TIMEZONE = 'Asia/Kolkata';

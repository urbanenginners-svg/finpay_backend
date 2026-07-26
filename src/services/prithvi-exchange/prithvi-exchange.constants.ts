export const PRITHVI_API_PATHS = {
  OAUTH_TOKEN: '/auth/oauth/token',
  OAUTH_REFRESH: '/auth/oauth/refresh',
  OAUTH_INTROSPECT: '/auth/oauth/introspect',
  OAUTH_REVOKE: '/auth/oauth/revoke',
  AGENT_RATES: '/rates/agents',
  PASSPORT_VERIFY: '/verification/passport',
  PAN_VERIFY: '/verification/pan-number',
  FOREX_INITIATE: '/forex/initiate',
  FOREX_COMPLETE: '/forex/:id/complete',
  FOREX_ORDERS_DASHBOARD: '/forex/orders/dashboard',
  ORDER_UPLOAD_DOCUMENT: '/orders/:orderId/upload-document',
  PURPOSE_LIST: '/purpose',
  PURPOSE_CONFIG: '/purpose/:code/config',
} as const;

/** Draft forex rate lock window from Prithvi (Step 1 → Step 2). */
export const PRITHVI_FOREX_DRAFT_TTL_MS = 20 * 60 * 1000;

export const PRITHVI_DEFAULT_SCOPE = 'read write';

/** Refresh access token when less than this many ms remain before expiry. */
export const PRITHVI_TOKEN_REFRESH_BUFFER_MS = 60 * 60 * 1000;

export const PRITHVI_PROVIDER_NAME = 'prithvi';

/** Agent rates sync schedule: 9 AM and 6 PM IST. */
export const PRITHVI_AGENT_RATES_CRON = '0 9,18 * * *';
export const PRITHVI_AGENT_RATES_CRON_TIMEZONE = 'Asia/Kolkata';

/** Purpose list sync: 1st of each month at 2:00 AM IST. */
export const PRITHVI_PURPOSE_LIST_CRON = '0 2 1 * *';
export const PRITHVI_PURPOSE_LIST_CRON_TIMEZONE = 'Asia/Kolkata';

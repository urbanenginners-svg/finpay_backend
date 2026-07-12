export const PRITHVI_LEAD_SYSTEM_API_PATHS = {
  OAUTH_TOKEN: '/auth/oauth/token',
  OAUTH_REFRESH: '/auth/oauth/refresh',
  OAUTH_INTROSPECT: '/auth/oauth/introspect',
  OAUTH_REVOKE: '/auth/oauth/revoke',
  PASSPORT_VERIFY: '/verification/passport',
  PAN_VERIFY: '/verification/pan-number',
} as const;

export const PRITHVI_LEAD_SYSTEM_DEFAULT_SCOPE = 'read write';

/** Refresh access token when less than this many ms remain before expiry. */
export const PRITHVI_LEAD_SYSTEM_TOKEN_REFRESH_BUFFER_MS = 60 * 60 * 1000;

export const PRITHVI_LEAD_SYSTEM_PASSPORT_VALID_STATUS = 'VALID';

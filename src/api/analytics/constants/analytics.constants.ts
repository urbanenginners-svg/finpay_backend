/**
 * Raw visit data (visitors, sessions, page views) is deleted by MongoDB TTL
 * indexes after this many days. Changing it requires updating the existing
 * TTL indexes (collMod) — Mongoose will not alter an index that already exists.
 */
export const ANALYTICS_RETENTION_DAYS = 395;
export const ANALYTICS_RETENTION_SECONDS = ANALYTICS_RETENTION_DAYS * 24 * 60 * 60;

export const ANALYTICS_DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const ANALYTICS_DEFAULT_RANGE_DAYS = 30;
export const ANALYTICS_MAX_RANGE_DAYS = 400;
export const ANALYTICS_TOP_LIMIT = 10;

export enum TrafficChannel {
  DIRECT = 'direct',
  ORGANIC_SEARCH = 'organic_search',
  PAID = 'paid',
  SOCIAL = 'social',
  EMAIL = 'email',
  REFERRAL = 'referral',
  CAMPAIGN = 'campaign',
}

export const SEARCH_ENGINE_HOSTS: Record<string, string> = {
  google: 'google',
  bing: 'bing',
  yahoo: 'yahoo',
  duckduckgo: 'duckduckgo',
  baidu: 'baidu',
  yandex: 'yandex',
  ecosia: 'ecosia',
  brave: 'brave',
};

export const SOCIAL_HOSTS: Record<string, string> = {
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'm.facebook.com': 'facebook',
  'l.facebook.com': 'facebook',
  'lm.facebook.com': 'facebook',
  'instagram.com': 'instagram',
  'l.instagram.com': 'instagram',
  't.co': 'twitter',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'linkedin.com': 'linkedin',
  'lnkd.in': 'linkedin',
  'youtube.com': 'youtube',
  'm.youtube.com': 'youtube',
  'whatsapp.com': 'whatsapp',
  'wa.me': 'whatsapp',
  'web.whatsapp.com': 'whatsapp',
  'reddit.com': 'reddit',
  'pinterest.com': 'pinterest',
  'quora.com': 'quora',
  't.me': 'telegram',
  'telegram.org': 'telegram',
};

export const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'display', 'cpm', 'paid_social', 'paidsocial']);
export const SOCIAL_MEDIUMS = new Set(['social', 'social-network', 'social_media', 'sm']);

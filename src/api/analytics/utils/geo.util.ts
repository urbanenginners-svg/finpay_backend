import * as geoip from 'geoip-lite';

export interface GeoLocation {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function getClientIp(headers: Record<string, unknown>, fallbackIp?: string): string | undefined {
  const forwarded = headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof first === 'string' && first.trim()) {
    return first.split(',')[0].trim();
  }
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  return fallbackIp;
}

/**
 * Resolves an approximate location (city level at best) from an IP using the
 * bundled offline GeoLite database, so the IP never leaves this server.
 * A CDN country header (Cloudflare / CloudFront) is used when present.
 */
export function lookupGeo(ip: string | undefined, headers: Record<string, unknown>): GeoLocation {
  const cdnCountry = headers['cf-ipcountry'] ?? headers['cloudfront-viewer-country'];
  const cleanIp = ip?.replace(/^::ffff:/, '');
  const hit = cleanIp ? geoip.lookup(cleanIp) : null;

  const code =
    hit?.country ||
    (typeof cdnCountry === 'string' && /^[A-Z]{2}$/.test(cdnCountry) && cdnCountry !== 'XX'
      ? cdnCountry
      : undefined);

  if (!code) return {};

  return {
    countryCode: code,
    country: countryName(code),
    region: hit?.region || undefined,
    city: hit?.city || undefined,
    timezone: hit?.timezone || undefined,
  };
}

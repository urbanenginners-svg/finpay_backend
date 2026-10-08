import {
  PAID_MEDIUMS,
  SEARCH_ENGINE_HOSTS,
  SOCIAL_HOSTS,
  SOCIAL_MEDIUMS,
  TrafficChannel,
} from '../constants/analytics.constants';

export interface TrafficSourceInput {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  /** Hosts considered "our own site"; referrers from these count as direct. */
  ownHosts: string[];
}

export interface TrafficSource {
  source: string;
  medium: string;
  channel: TrafficChannel;
  campaign?: string;
  term?: string;
  content?: string;
  referrer?: string;
  referrerHost?: string;
}

export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** Keeps only origin + path so query strings (which can carry personal data) are never stored. */
function parseReferrer(referrer?: string): { url: string; host: string } | null {
  if (!referrer) return null;
  try {
    const parsed = new URL(referrer);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return {
      url: `${parsed.origin}${parsed.pathname}`.slice(0, 512),
      host: normalizeHost(parsed.hostname),
    };
  } catch {
    return null;
  }
}

function searchEngineFor(host: string): string | undefined {
  const labels = host.split('.');
  return labels.map((label) => SEARCH_ENGINE_HOSTS[label]).find(Boolean);
}

function socialNetworkFor(host: string): string | undefined {
  if (SOCIAL_HOSTS[host]) return SOCIAL_HOSTS[host];
  const parent = host.split('.').slice(-2).join('.');
  return SOCIAL_HOSTS[parent];
}

function clean(value?: string): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

export function classifyTrafficSource(input: TrafficSourceInput): TrafficSource {
  const ownHosts = input.ownHosts.map(normalizeHost);
  const ref = parseReferrer(input.referrer);
  const external = ref && !ownHosts.includes(ref.host) ? ref : null;

  const utmSource = clean(input.utmSource);
  const utmMedium = clean(input.utmMedium);
  const campaignFields = {
    campaign: clean(input.utmCampaign),
    term: clean(input.utmTerm),
    content: clean(input.utmContent),
  };
  const referrerFields = external
    ? { referrer: external.url, referrerHost: external.host }
    : {};

  if (utmSource || utmMedium) {
    const medium = utmMedium ?? '(not set)';
    let channel = TrafficChannel.CAMPAIGN;
    if (PAID_MEDIUMS.has(medium)) channel = TrafficChannel.PAID;
    else if (medium === 'email' || medium === 'newsletter') channel = TrafficChannel.EMAIL;
    else if (SOCIAL_MEDIUMS.has(medium)) channel = TrafficChannel.SOCIAL;
    else if (medium === 'organic') channel = TrafficChannel.ORGANIC_SEARCH;
    else if (medium === 'referral') channel = TrafficChannel.REFERRAL;

    return {
      source: utmSource ?? external?.host ?? '(direct)',
      medium,
      channel,
      ...campaignFields,
      ...referrerFields,
    };
  }

  if (external) {
    const engine = searchEngineFor(external.host);
    if (engine) {
      return { source: engine, medium: 'organic', channel: TrafficChannel.ORGANIC_SEARCH, ...referrerFields };
    }
    const network = socialNetworkFor(external.host);
    if (network) {
      return { source: network, medium: 'social', channel: TrafficChannel.SOCIAL, ...referrerFields };
    }
    return { source: external.host, medium: 'referral', channel: TrafficChannel.REFERRAL, ...referrerFields };
  }

  return { source: '(direct)', medium: '(none)', channel: TrafficChannel.DIRECT };
}

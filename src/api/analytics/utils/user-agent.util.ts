export interface ParsedUserAgent {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  browserVersion?: string;
  os: string;
  isBot: boolean;
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|headlesschrome|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|postman/i;

function matchVersion(ua: string, pattern: RegExp): string | undefined {
  const match = ua.match(pattern);
  return match?.[1]?.split('.').slice(0, 2).join('.');
}

function detectBrowser(ua: string): { browser: string; browserVersion?: string } {
  const rules: Array<[string, RegExp]> = [
    ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['UC Browser', /UCBrowser\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];

  for (const [browser, pattern] of rules) {
    if (pattern.test(ua)) {
      return { browser, browserVersion: matchVersion(ua, pattern) };
    }
  }
  return { browser: 'Other' };
}

function detectOs(ua: string): string {
  if (/Windows/i.test(ua)) return 'Windows';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/CrOS/i.test(ua)) return 'Chrome OS';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Other';
}

function detectDeviceType(ua: string): ParsedUserAgent['deviceType'] {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function parseUserAgent(rawUa: string | undefined): ParsedUserAgent {
  const ua = (rawUa ?? '').slice(0, 512);
  if (!ua) {
    return { deviceType: 'desktop', browser: 'Other', os: 'Other', isBot: true };
  }

  return {
    ...detectBrowser(ua),
    os: detectOs(ua),
    deviceType: detectDeviceType(ua),
    isBot: BOT_PATTERN.test(ua),
  };
}

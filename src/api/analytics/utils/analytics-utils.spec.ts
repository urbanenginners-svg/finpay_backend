import { TrafficChannel } from '../constants/analytics.constants';
import { classifyTrafficSource } from './traffic-source.util';
import { parseUserAgent } from './user-agent.util';

const ownHosts = ['finpayremit.com'];

describe('classifyTrafficSource', () => {
  it('treats no referrer and no UTM as direct', () => {
    expect(classifyTrafficSource({ ownHosts })).toMatchObject({
      source: '(direct)',
      medium: '(none)',
      channel: TrafficChannel.DIRECT,
    });
  });

  it('treats internal referrers as direct', () => {
    const result = classifyTrafficSource({ ownHosts, referrer: 'https://www.finpayremit.com/enquiry' });
    expect(result.channel).toBe(TrafficChannel.DIRECT);
    expect(result.referrerHost).toBeUndefined();
  });

  it('detects organic search engines', () => {
    expect(classifyTrafficSource({ ownHosts, referrer: 'https://www.google.co.in/' })).toMatchObject({
      source: 'google',
      medium: 'organic',
      channel: TrafficChannel.ORGANIC_SEARCH,
      referrerHost: 'google.co.in',
    });
  });

  it('detects social networks including subdomains', () => {
    expect(classifyTrafficSource({ ownHosts, referrer: 'https://l.instagram.com/' })).toMatchObject({
      source: 'instagram',
      channel: TrafficChannel.SOCIAL,
    });
    expect(classifyTrafficSource({ ownHosts, referrer: 'https://in.linkedin.com/feed' })).toMatchObject({
      source: 'linkedin',
      channel: TrafficChannel.SOCIAL,
    });
  });

  it('classifies other sites as referral and strips query strings', () => {
    const result = classifyTrafficSource({ ownHosts, referrer: 'https://blog.example.org/post?email=a@b.com' });
    expect(result).toMatchObject({ source: 'blog.example.org', medium: 'referral', channel: TrafficChannel.REFERRAL });
    expect(result.referrer).toBe('https://blog.example.org/post');
  });

  it('prefers UTM parameters and maps paid mediums', () => {
    expect(
      classifyTrafficSource({
        ownHosts,
        referrer: 'https://www.google.com/',
        utmSource: 'Google',
        utmMedium: 'CPC',
        utmCampaign: 'Diwali Forex',
      }),
    ).toMatchObject({ source: 'google', medium: 'cpc', channel: TrafficChannel.PAID, campaign: 'diwali forex' });
  });

  it('maps email and generic campaign mediums', () => {
    expect(classifyTrafficSource({ ownHosts, utmSource: 'mailchimp', utmMedium: 'email' }).channel).toBe(
      TrafficChannel.EMAIL,
    );
    expect(classifyTrafficSource({ ownHosts, utmSource: 'partner', utmMedium: 'banner' }).channel).toBe(
      TrafficChannel.CAMPAIGN,
    );
  });

  it('ignores non-http referrers', () => {
    expect(classifyTrafficSource({ ownHosts, referrer: 'android-app://com.google.android.gm' }).channel).toBe(
      TrafficChannel.DIRECT,
    );
  });
});

describe('parseUserAgent', () => {
  it('parses desktop Chrome on Windows', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      ),
    ).toMatchObject({ deviceType: 'desktop', browser: 'Chrome', browserVersion: '129.0', os: 'Windows', isBot: false });
  });

  it('parses Safari on iPhone', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toMatchObject({ deviceType: 'mobile', browser: 'Safari', os: 'iOS', isBot: false });
  });

  it('parses Edge and Android tablets', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
      ).browser,
    ).toBe('Edge');
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      ).deviceType,
    ).toBe('tablet');
  });

  it('flags bots and empty user agents', () => {
    expect(parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').isBot).toBe(true);
    expect(parseUserAgent(undefined).isBot).toBe(true);
  });
});

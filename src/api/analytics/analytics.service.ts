import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';

import {
  AnalyticsVisitor,
  AnalyticsVisitorDocument,
} from 'src/services/mongoose/schemas/analytics-visitor.schema';
import {
  AnalyticsSession,
  AnalyticsSessionDocument,
} from 'src/services/mongoose/schemas/analytics-session.schema';
import {
  AnalyticsPageView,
  AnalyticsPageViewDocument,
} from 'src/services/mongoose/schemas/analytics-page-view.schema';
import {
  ServiceEnquiry,
  ServiceEnquiryAttribution,
  ServiceEnquiryDocument,
} from 'src/services/mongoose/schemas/service-enquiry.schema';
import { AppConfigService } from 'src/services/env/env.service';
import { PageMeta } from 'src/utils/response/page-meta';
import { AnalyticsLeadsQueryDto, AnalyticsRangeQueryDto, AnalyticsVisitsQueryDto, CollectEventDto } from './dto';
import {
  ANALYTICS_DEFAULT_TIMEZONE,
  ANALYTICS_RETENTION_DAYS,
  ANALYTICS_TOP_LIMIT,
} from './constants/analytics.constants';
import { eachDate, previousRange, resolveRange } from './analytics-range.util';
import { parseUserAgent } from './utils/user-agent.util';
import { classifyTrafficSource, normalizeHost } from './utils/traffic-source.util';
import { getClientIp, lookupGeo } from './utils/geo.util';

export interface CollectContext {
  headers: Record<string, unknown>;
  ip?: string;
}

export interface EnquiryTrackingRef {
  visitorId: string;
  sessionId: string;
}

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const MONGO_UNKNOWN_TIMEZONE = 40485;
const EXPORT_ROW_LIMIT = 50_000;

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pageArgs(query: { page?: number | string; limit?: number | string }) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** Groups by `key`, counting sessions and distinct visitors per bucket. */
function breakdown(key: unknown, limit = ANALYTICS_TOP_LIMIT, preMatch?: Record<string, unknown>): PipelineStage.FacetPipelineStage[] {
  return [
    ...(preMatch ? [{ $match: preMatch }] : []),
    { $group: { _id: { k: key, v: '$visitorId' }, sessions: { $sum: 1 } } },
    { $group: { _id: '$_id.k', sessions: { $sum: '$sessions' }, visitors: { $sum: 1 } } },
    { $sort: { sessions: -1 } },
    { $limit: limit },
  ];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(AnalyticsVisitor.name)
    private readonly visitorModel: Model<AnalyticsVisitorDocument>,
    @InjectModel(AnalyticsSession.name)
    private readonly sessionModel: Model<AnalyticsSessionDocument>,
    @InjectModel(AnalyticsPageView.name)
    private readonly pageViewModel: Model<AnalyticsPageViewDocument>,
    @InjectModel(ServiceEnquiry.name)
    private readonly enquiryModel: Model<ServiceEnquiryDocument>,
    private readonly config: AppConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Collection
  // ---------------------------------------------------------------------------

  private ownHosts(headers: Record<string, unknown>): string[] {
    const hosts = new Set<string>();
    for (const raw of [this.config.get('FRONTEND_URL'), headers.origin]) {
      if (typeof raw !== 'string' || !raw) continue;
      try {
        hosts.add(normalizeHost(new URL(raw).hostname));
      } catch {
        // ignore malformed URLs
      }
    }
    return [...hosts];
  }

  async collect(dto: CollectEventDto, ctx: CollectContext): Promise<{ tracked: boolean }> {
    if (ctx.headers['sec-gpc'] === '1') {
      return { tracked: false };
    }

    const ua = parseUserAgent(ctx.headers['user-agent'] as string | undefined);
    if (ua.isBot) {
      return { tracked: false };
    }

    const now = new Date();
    const path = dto.path;
    const title = dto.title?.trim() || undefined;

    let isNewSession = false;
    const existingSession = await this.sessionModel
      .findOneAndUpdate(
        { _id: dto.sessionId, visitorId: dto.visitorId },
        { $set: { lastActivityAt: now, exitPage: path }, $inc: { pageViewCount: 1 } },
        { projection: { _id: 1 } },
      )
      .lean();

    if (!existingSession) {
      if (await this.sessionModel.exists({ _id: dto.sessionId })) {
        return { tracked: false };
      }

      const visitorExists = Boolean(await this.visitorModel.exists({ _id: dto.visitorId }));
      const geo = lookupGeo(getClientIp(ctx.headers, ctx.ip), ctx.headers);
      const traffic = classifyTrafficSource({ ...dto, ownHosts: this.ownHosts(ctx.headers) });

      try {
        await this.sessionModel.create(
          compact({
            _id: dto.sessionId,
            visitorId: dto.visitorId,
            isNewVisitor: !visitorExists,
            startedAt: now,
            lastActivityAt: now,
            pageViewCount: 1,
            landingPage: path,
            exitPage: path,
            ...traffic,
            ...geo,
            deviceType: ua.deviceType,
            browser: ua.browser,
            browserVersion: ua.browserVersion,
            os: ua.os,
            language: dto.language,
            screen: dto.screen,
          }),
        );
        isNewSession = true;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        await this.sessionModel.updateOne(
          { _id: dto.sessionId, visitorId: dto.visitorId },
          { $set: { lastActivityAt: now, exitPage: path }, $inc: { pageViewCount: 1 } },
        );
      }

      if (isNewSession) {
        await this.visitorModel.updateOne(
          { _id: dto.visitorId },
          {
            $setOnInsert: compact({
              firstSeenAt: now,
              firstSource: traffic.source,
              firstMedium: traffic.medium,
              firstChannel: traffic.channel,
              firstLandingPage: path,
            }),
            $set: compact({
              lastSeenAt: now,
              country: geo.country,
              countryCode: geo.countryCode,
              region: geo.region,
              city: geo.city,
              deviceType: ua.deviceType,
              browser: ua.browser,
              os: ua.os,
            }),
            $inc: { sessionCount: 1, pageViewCount: 1 },
          },
          { upsert: true },
        );
      }
    }

    if (!isNewSession) {
      await this.visitorModel.updateOne(
        { _id: dto.visitorId },
        { $set: { lastSeenAt: now }, $inc: { pageViewCount: 1 } },
      );
    }

    await this.pageViewModel.create(
      compact({ sessionId: dto.sessionId, visitorId: dto.visitorId, path, title, viewedAt: now }),
    );

    return { tracked: true };
  }

  // ---------------------------------------------------------------------------
  // Lead attribution
  // ---------------------------------------------------------------------------

  async getAttribution(ref: EnquiryTrackingRef): Promise<ServiceEnquiryAttribution | null> {
    const session = await this.sessionModel.findOne({ _id: ref.sessionId, visitorId: ref.visitorId }).lean();
    if (!session) return null;

    return compact({
      visitorId: session.visitorId,
      sessionId: session._id,
      isNewVisitor: session.isNewVisitor,
      sessionStartedAt: session.startedAt,
      source: session.source,
      medium: session.medium,
      channel: session.channel,
      campaign: session.campaign,
      referrerHost: session.referrerHost,
      landingPage: session.landingPage,
      pagesBeforeLead: session.pageViewCount,
      country: session.country,
      region: session.region,
      city: session.city,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
    }) as ServiceEnquiryAttribution;
  }

  async markConverted(ref: EnquiryTrackingRef, enquiryId: string): Promise<void> {
    await Promise.all([
      this.sessionModel.updateOne(
        { _id: ref.sessionId, visitorId: ref.visitorId },
        { $set: { convertedEnquiryId: enquiryId } },
      ),
      this.visitorModel.updateOne({ _id: ref.visitorId }, { $addToSet: { enquiryIds: enquiryId } }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------

  private async totalsFor(from: Date, to: Date) {
    const [sessionTotals, visitorTotals, leads] = await Promise.all([
      this.sessionModel.aggregate([
        { $match: { startedAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            pageViews: { $sum: '$pageViewCount' },
            bounces: { $sum: { $cond: [{ $lte: ['$pageViewCount', 1] }, 1, 0] } },
            returningSessions: { $sum: { $cond: ['$isNewVisitor', 0, 1] } },
            convertedSessions: { $sum: { $cond: [{ $ifNull: ['$convertedEnquiryId', false] }, 1, 0] } },
          },
        },
      ]),
      this.sessionModel.aggregate([
        { $match: { startedAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: '$visitorId',
            isNew: { $max: { $cond: ['$isNewVisitor', 1, 0] } },
            isReturning: { $max: { $cond: ['$isNewVisitor', 0, 1] } },
          },
        },
        {
          $group: {
            _id: null,
            visitors: { $sum: 1 },
            newVisitors: { $sum: '$isNew' },
            returningVisitors: { $sum: '$isReturning' },
          },
        },
      ]),
      this.enquiryModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: null,
            leads: { $sum: 1 },
            trackedLeads: { $sum: { $cond: [{ $ifNull: ['$attribution.channel', false] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const s = sessionTotals[0] ?? { sessions: 0, pageViews: 0, bounces: 0, returningSessions: 0, convertedSessions: 0 };
    const v = visitorTotals[0] ?? { visitors: 0, newVisitors: 0, returningVisitors: 0 };
    const l = leads[0] ?? { leads: 0, trackedLeads: 0 };
    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      visitors: v.visitors,
      // A first-time visitor who comes back within the period counts in both.
      newVisitors: v.newVisitors,
      returningVisitors: v.returningVisitors,
      sessions: s.sessions,
      newSessions: s.sessions - s.returningSessions,
      returningSessions: s.returningSessions,
      pageViews: s.pageViews,
      avgPagesPerSession: s.sessions ? round(s.pageViews / s.sessions) : 0,
      bounceRate: s.sessions ? round((s.bounces / s.sessions) * 100) : 0,
      leads: l.leads,
      trackedLeads: l.trackedLeads,
      conversionRate: s.sessions ? round((s.convertedSessions / s.sessions) * 100) : 0,
    };
  }

  async getOverview(query: AnalyticsRangeQueryDto) {
    try {
      return await this.buildOverview(query);
    } catch (error) {
      const unknownZone = (error as { code?: number }).code === MONGO_UNKNOWN_TIMEZONE;
      if (!unknownZone || !query.tz || query.tz === ANALYTICS_DEFAULT_TIMEZONE) throw error;
      this.logger.warn(`MongoDB does not recognise timezone '${query.tz}'; using ${ANALYTICS_DEFAULT_TIMEZONE}`);
      return this.buildOverview({ ...query, tz: ANALYTICS_DEFAULT_TIMEZONE });
    }
  }

  private async buildOverview(query: AnalyticsRangeQueryDto) {
    const range = resolveRange(query);
    const { from, to, tz } = range;
    const prev = previousRange(range);
    const match = { startedAt: { $gte: from, $lte: to } };

    const [totals, previousTotals, facetResult, topPages, leadsDaily, leadChannels, activeNow] = await Promise.all([
      this.totalsFor(from, to),
      this.totalsFor(prev.from, prev.to),
      this.sessionModel.aggregate([
        { $match: match },
        {
          $facet: {
            daily: [
              {
                $group: {
                  _id: {
                    d: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: tz } },
                    v: '$visitorId',
                  },
                  sessions: { $sum: 1 },
                  pageViews: { $sum: '$pageViewCount' },
                  isNew: { $max: { $cond: ['$isNewVisitor', 1, 0] } },
                  isReturning: { $max: { $cond: ['$isNewVisitor', 0, 1] } },
                },
              },
              {
                $group: {
                  _id: '$_id.d',
                  visitors: { $sum: 1 },
                  newVisitors: { $sum: '$isNew' },
                  returningVisitors: { $sum: '$isReturning' },
                  sessions: { $sum: '$sessions' },
                  pageViews: { $sum: '$pageViews' },
                },
              },
            ],
            hourly: [
              { $group: { _id: { $hour: { date: '$startedAt', timezone: tz } }, sessions: { $sum: 1 } } },
            ],
            weekdays: [
              { $group: { _id: { $isoDayOfWeek: { date: '$startedAt', timezone: tz } }, sessions: { $sum: 1 } } },
            ],
            channels: breakdown('$channel', 20),
            sources: breakdown({ source: '$source', medium: '$medium' }),
            campaigns: breakdown('$campaign', ANALYTICS_TOP_LIMIT, { campaign: { $exists: true } }),
            referrers: breakdown('$referrerHost', ANALYTICS_TOP_LIMIT, { referrerHost: { $exists: true } }),
            landingPages: breakdown('$landingPage'),
            countries: breakdown({ $ifNull: ['$country', 'Unknown'] }),
            cities: breakdown(
              { city: '$city', region: '$region', country: '$country' },
              ANALYTICS_TOP_LIMIT,
              { city: { $exists: true } },
            ),
            devices: breakdown({ $ifNull: ['$deviceType', 'unknown'] }),
            browsers: breakdown({ $ifNull: ['$browser', 'Other'] }),
            operatingSystems: breakdown({ $ifNull: ['$os', 'Other'] }),
          },
        },
      ]),
      this.pageViewModel.aggregate([
        { $match: { viewedAt: { $gte: from, $lte: to } } },
        { $group: { _id: { p: '$path', v: '$visitorId' }, views: { $sum: 1 } } },
        { $group: { _id: '$_id.p', views: { $sum: '$views' }, visitors: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: ANALYTICS_TOP_LIMIT },
      ]),
      this.enquiryModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
            leads: { $sum: 1 },
          },
        },
      ]),
      this.enquiryModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: { $ifNull: ['$attribution.channel', 'untracked'] }, leads: { $sum: 1 } } },
        { $sort: { leads: -1 } },
      ]),
      this.sessionModel.countDocuments({ lastActivityAt: { $gte: new Date(Date.now() - ACTIVE_WINDOW_MS) } }),
    ]);

    const facets = facetResult[0];
    const dailyByDate = new Map<
      string,
      { visitors: number; newVisitors: number; returningVisitors: number; sessions: number; pageViews: number }
    >(
      facets.daily.map((row) => [row._id, row]),
    );
    const leadsByDate = new Map<string, number>(leadsDaily.map((row) => [row._id, row.leads]));
    const hourly = new Map<number, number>(facets.hourly.map((row) => [row._id, row.sessions]));
    const weekdays = new Map<number, number>(facets.weekdays.map((row) => [row._id, row.sessions]));

    const mapRows = <K extends string>(rows: Array<{ _id: unknown; sessions: number; visitors: number }>, keyName: K) =>
      rows.map((row) => ({ [keyName]: row._id, sessions: row.sessions, visitors: row.visitors }) as Record<K, unknown> & { sessions: number; visitors: number });

    return {
      range: { from: range.fromDate, to: range.toDate, tz },
      retentionDays: ANALYTICS_RETENTION_DAYS,
      activeNow,
      totals,
      previousTotals,
      daily: eachDate(range.fromDate, range.toDate).map((date) => {
        const row = dailyByDate.get(date);
        return {
          date,
          visitors: row?.visitors ?? 0,
          newVisitors: row?.newVisitors ?? 0,
          returningVisitors: row?.returningVisitors ?? 0,
          sessions: row?.sessions ?? 0,
          pageViews: row?.pageViews ?? 0,
          leads: leadsByDate.get(date) ?? 0,
        };
      }),
      hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: hourly.get(hour) ?? 0 })),
      weekdays: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, sessions: weekdays.get(i + 1) ?? 0 })),
      topPages: topPages.map((row) => ({ path: row._id, views: row.views, visitors: row.visitors })),
      landingPages: mapRows(facets.landingPages, 'path'),
      channels: mapRows(facets.channels, 'channel'),
      sources: facets.sources.map((row) => ({
        source: row._id.source,
        medium: row._id.medium,
        sessions: row.sessions,
        visitors: row.visitors,
      })),
      campaigns: mapRows(facets.campaigns, 'campaign'),
      referrers: mapRows(facets.referrers, 'host'),
      countries: mapRows(facets.countries, 'country'),
      cities: facets.cities.map((row) => ({ ...row._id, sessions: row.sessions, visitors: row.visitors })),
      devices: mapRows(facets.devices, 'deviceType'),
      browsers: mapRows(facets.browsers, 'browser'),
      operatingSystems: mapRows(facets.operatingSystems, 'os'),
      leadChannels: leadChannels.map((row) => ({ channel: row._id, leads: row.leads })),
    };
  }

  private visitsMatch(query: AnalyticsVisitsQueryDto) {
    const range = resolveRange(query);
    const match: Record<string, unknown> = { startedAt: { $gte: range.from, $lte: range.to } };
    if (query.channel) match.channel = query.channel;
    if (query.deviceType) match.deviceType = query.deviceType;
    if (query.visitorType) match.isNewVisitor = query.visitorType === 'new';
    if (query.q?.trim()) {
      const regex = { $regex: escapeRegex(query.q.trim()), $options: 'i' };
      match.$or = [
        { country: regex },
        { city: regex },
        { source: regex },
        { campaign: regex },
        { referrerHost: regex },
        { landingPage: regex },
        { visitorId: query.q.trim() },
      ];
    }
    return match;
  }

  private visitsPipeline(match: Record<string, unknown>, skip: number, limit: number): PipelineStage[] {
    return [
      { $match: match },
      { $sort: { startedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'analytics_page_views',
          let: { sid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$sessionId', '$$sid'] } } },
            { $sort: { viewedAt: 1 } },
            { $limit: 50 },
            { $project: { _id: 0, path: 1, title: 1, viewedAt: 1 } },
          ],
          as: 'pages',
        },
      },
      {
        $lookup: {
          from: 'service_enquiries',
          localField: 'convertedEnquiryId',
          foreignField: '_id',
          pipeline: [{ $project: { referenceNumber: 1, serviceType: 1, 'contact.fullName': 1 } }],
          as: 'enquiry',
        },
      },
      { $set: { enquiry: { $first: '$enquiry' } } },
    ];
  }

  async getVisits(query: AnalyticsVisitsQueryDto) {
    const { page, limit, skip } = pageArgs(query);
    const match = this.visitsMatch(query);

    const [data, itemCount] = await Promise.all([
      this.sessionModel.aggregate(this.visitsPipeline(match, skip, limit)),
      this.sessionModel.countDocuments(match),
    ]);

    return { data, meta: new PageMeta(itemCount, { page, limit }) };
  }

  async getVisitsForExport(query: AnalyticsVisitsQueryDto) {
    return this.sessionModel.aggregate(this.visitsPipeline(this.visitsMatch(query), 0, EXPORT_ROW_LIMIT));
  }

  private leadsMatch(query: AnalyticsLeadsQueryDto) {
    const range = resolveRange(query);
    const match: Record<string, unknown> = { createdAt: { $gte: range.from, $lte: range.to } };
    if (query.channel === 'untracked') match['attribution.channel'] = { $exists: false };
    else if (query.channel) match['attribution.channel'] = query.channel;
    if (query.q?.trim()) {
      const regex = { $regex: escapeRegex(query.q.trim()), $options: 'i' };
      match.$or = [
        { 'contact.fullName': regex },
        { 'contact.email': regex },
        { 'contact.mobile': regex },
        { referenceNumber: regex },
      ];
    }
    return match;
  }

  private readonly leadProjection = {
    referenceNumber: 1,
    serviceType: 1,
    status: 1,
    isPriority: 1,
    contact: 1,
    attribution: 1,
    estimatedInrValue: 1,
    createdAt: 1,
  };

  async getLeads(query: AnalyticsLeadsQueryDto) {
    const { page, limit, skip } = pageArgs(query);
    const match = this.leadsMatch(query);

    const [data, itemCount] = await Promise.all([
      this.enquiryModel.find(match, this.leadProjection).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.enquiryModel.countDocuments(match),
    ]);

    return { data, meta: new PageMeta(itemCount, { page, limit }) };
  }

  async getLeadsForExport(query: AnalyticsLeadsQueryDto) {
    return this.enquiryModel
      .find(this.leadsMatch(query), this.leadProjection)
      .sort({ createdAt: -1 })
      .limit(EXPORT_ROW_LIMIT)
      .lean();
  }

  /** Erases all browsing data for one visitor (e.g. on a data-deletion request). Lead contact records are kept. */
  async deleteVisitor(visitorId: string) {
    const [visitor, sessions, pageViews, enquiries] = await Promise.all([
      this.visitorModel.deleteOne({ _id: visitorId }),
      this.sessionModel.deleteMany({ visitorId }),
      this.pageViewModel.deleteMany({ visitorId }),
      this.enquiryModel.updateMany(
        { 'attribution.visitorId': visitorId },
        { $unset: { 'attribution.visitorId': '', 'attribution.sessionId': '' } },
      ),
    ]);

    if (!visitor.deletedCount && !sessions.deletedCount && !pageViews.deletedCount) {
      throw new NotFoundException(`No analytics data found for visitor '${visitorId}'`);
    }

    this.logger.log(`Erased analytics data for visitor ${visitorId}`);
    return {
      visitorId,
      sessionsDeleted: sessions.deletedCount,
      pageViewsDeleted: pageViews.deletedCount,
      enquiriesUnlinked: enquiries.modifiedCount,
    };
  }
}

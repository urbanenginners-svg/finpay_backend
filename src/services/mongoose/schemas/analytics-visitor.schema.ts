import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { ANALYTICS_RETENTION_SECONDS } from 'src/api/analytics/constants/analytics.constants';

export type AnalyticsVisitorDocument = AnalyticsVisitor & Document;

/**
 * One row per pseudonymous browser (first-party random ID kept in localStorage,
 * only created after the visitor accepts analytics). No IP address is stored.
 */
@Schema({ collection: 'analytics_visitors', timestamps: false, versionKey: false })
export class AnalyticsVisitor {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Date, required: true })
  firstSeenAt: Date;

  @Prop({ type: Date, required: true })
  lastSeenAt: Date;

  @Prop({ type: Number, default: 0 })
  sessionCount: number;

  @Prop({ type: Number, default: 0 })
  pageViewCount: number;

  @Prop({ type: String })
  firstSource?: string;

  @Prop({ type: String })
  firstMedium?: string;

  @Prop({ type: String })
  firstChannel?: string;

  @Prop({ type: String })
  firstLandingPage?: string;

  @Prop({ type: String })
  country?: string;

  @Prop({ type: String })
  countryCode?: string;

  @Prop({ type: String })
  region?: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  deviceType?: string;

  @Prop({ type: String })
  browser?: string;

  @Prop({ type: String })
  os?: string;

  @Prop({ type: [String], default: [] })
  enquiryIds: string[];
}

export const AnalyticsVisitorSchema = SchemaFactory.createForClass(AnalyticsVisitor);

AnalyticsVisitorSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: ANALYTICS_RETENTION_SECONDS });
AnalyticsVisitorSchema.index({ firstSeenAt: -1 });

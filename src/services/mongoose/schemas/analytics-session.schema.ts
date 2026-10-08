import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import {
  ANALYTICS_RETENTION_SECONDS,
  TrafficChannel,
} from 'src/api/analytics/constants/analytics.constants';

export type AnalyticsSessionDocument = AnalyticsSession & Document;

@Schema({ collection: 'analytics_sessions', timestamps: false, versionKey: false })
export class AnalyticsSession {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  visitorId: string;

  @Prop({ type: Boolean, required: true })
  isNewVisitor: boolean;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, required: true })
  lastActivityAt: Date;

  @Prop({ type: Number, default: 0 })
  pageViewCount: number;

  @Prop({ type: String, required: true })
  landingPage: string;

  @Prop({ type: String })
  exitPage?: string;

  @Prop({ type: String })
  referrer?: string;

  @Prop({ type: String })
  referrerHost?: string;

  @Prop({ type: String, required: true })
  source: string;

  @Prop({ type: String, required: true })
  medium: string;

  @Prop({ type: String })
  campaign?: string;

  @Prop({ type: String })
  term?: string;

  @Prop({ type: String })
  content?: string;

  @Prop({ type: String, enum: Object.values(TrafficChannel), required: true })
  channel: TrafficChannel;

  @Prop({ type: String })
  country?: string;

  @Prop({ type: String })
  countryCode?: string;

  @Prop({ type: String })
  region?: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  timezone?: string;

  @Prop({ type: String })
  deviceType?: string;

  @Prop({ type: String })
  browser?: string;

  @Prop({ type: String })
  browserVersion?: string;

  @Prop({ type: String })
  os?: string;

  @Prop({ type: String })
  language?: string;

  @Prop({ type: String })
  screen?: string;

  @Prop({ type: String })
  convertedEnquiryId?: string;
}

export const AnalyticsSessionSchema = SchemaFactory.createForClass(AnalyticsSession);

AnalyticsSessionSchema.index({ startedAt: 1 }, { expireAfterSeconds: ANALYTICS_RETENTION_SECONDS });
AnalyticsSessionSchema.index({ visitorId: 1, startedAt: -1 });
AnalyticsSessionSchema.index({ channel: 1, startedAt: -1 });

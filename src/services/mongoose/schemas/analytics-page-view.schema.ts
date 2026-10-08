import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import { ANALYTICS_RETENTION_SECONDS } from 'src/api/analytics/constants/analytics.constants';

export type AnalyticsPageViewDocument = AnalyticsPageView & Document;

@Schema({ collection: 'analytics_page_views', timestamps: false, versionKey: false })
export class AnalyticsPageView {
  @Prop({ type: String, default: () => uuidv4() })
  _id?: string;

  @Prop({ type: String, required: true })
  sessionId: string;

  @Prop({ type: String, required: true })
  visitorId: string;

  @Prop({ type: String, required: true })
  path: string;

  @Prop({ type: String })
  title?: string;

  @Prop({ type: Date, required: true })
  viewedAt: Date;
}

export const AnalyticsPageViewSchema = SchemaFactory.createForClass(AnalyticsPageView);

AnalyticsPageViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: ANALYTICS_RETENTION_SECONDS });
AnalyticsPageViewSchema.index({ sessionId: 1, viewedAt: 1 });
AnalyticsPageViewSchema.index({ visitorId: 1 });

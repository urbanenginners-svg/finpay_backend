import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import * as mongoose from 'mongoose';

import { PrithviLeadSystemApiCallType } from 'src/services/prithvi-lead-system/prithvi-lead-system.types';

export type PrithviLeadSystemApiLogDocument =
  HydratedDocument<PrithviLeadSystemApiLog>;

@Schema({ collection: 'prithvi_lead_system_api_logs', timestamps: true })
export class PrithviLeadSystemApiLog {
  @ApiProperty({
    enum: PrithviLeadSystemApiCallType,
    description: 'Which Prithvi Lead System endpoint was called.',
    example: PrithviLeadSystemApiCallType.PAN_VERIFY,
  })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(PrithviLeadSystemApiCallType),
    index: true,
  })
  callType: PrithviLeadSystemApiCallType;

  @ApiProperty({ example: 'POST' })
  @Prop({ required: true, type: String })
  method: string;

  @ApiProperty({ example: 'http://leadsystem-dev-api…/api/verification/pan-number' })
  @Prop({ required: true, type: String })
  url: string;

  @ApiPropertyOptional({ type: Object })
  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: null })
  requestBody: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object })
  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: null })
  requestParams: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object })
  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: null })
  requestHeaders: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: 200 })
  @Prop({ required: false, type: Number, default: null })
  httpStatus: number | null;

  @ApiPropertyOptional({ type: Object })
  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: null })
  responseBody: Record<string, unknown> | null;

  @ApiProperty({ example: true })
  @Prop({ required: true, type: Boolean, index: true })
  success: boolean;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  errorMessage: string | null;

  @ApiProperty({ example: 142 })
  @Prop({ required: true, type: Number })
  durationMs: number;

  @ApiProperty({
    description:
      'True when PRITHVI_LEAD_SYSTEM_ACTIVE_MODE is off; the call was simulated without hitting the real API.',
    example: false,
  })
  @Prop({ required: true, type: Boolean, default: false })
  isDryRun: boolean;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const PrithviLeadSystemApiLogSchema =
  SchemaFactory.createForClass(PrithviLeadSystemApiLog);

PrithviLeadSystemApiLogSchema.index({ createdAt: -1 });
PrithviLeadSystemApiLogSchema.index({ callType: 1, createdAt: -1 });
PrithviLeadSystemApiLogSchema.index({ success: 1, createdAt: -1 });

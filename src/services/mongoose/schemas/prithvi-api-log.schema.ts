import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import * as mongoose from 'mongoose';

import { PrithviApiCallType } from 'src/services/prithvi-exchange/prithvi-exchange.types';

export type PrithviApiLogDocument = HydratedDocument<PrithviApiLog>;

/**
 * Persists a structured record of every outbound HTTP call made to the
 * Prithvi Exchange API.  Used for reconciliation, debugging, and audit.
 *
 * Sensitive values (client_secret, raw tokens) are redacted before storage.
 */
@Schema({ collection: 'prithvi_api_logs', timestamps: true })
export class PrithviApiLog {
  // ── Call identity ─────────────────────────────────────────────────────────

  @ApiProperty({
    enum: PrithviApiCallType,
    description: 'Which Prithvi endpoint was called.',
    example: PrithviApiCallType.AGENT_RATES,
  })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(PrithviApiCallType),
    index: true,
  })
  callType: PrithviApiCallType;

  @ApiProperty({
    description: 'HTTP method used (GET, POST, …).',
    example: 'POST',
  })
  @Prop({ required: true, type: String })
  method: string;

  @ApiProperty({
    description: 'Full URL of the outbound request.',
    example: 'https://api.prithvi.in/auth/oauth/token',
  })
  @Prop({ required: true, type: String })
  url: string;

  // ── Request details ────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    type: Object,
    description:
      'Sanitised request body (form fields).  Sensitive keys are replaced with "[REDACTED]".',
  })
  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: null })
  requestBody: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: Object,
    description: 'Query parameters sent with a GET request.',
  })
  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: null })
  requestParams: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Sanitised request headers. Authorization and other sensitive values are replaced with "[REDACTED]".',
  })
  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: null })
  requestHeaders: Record<string, unknown> | null;

  // ── Response details ───────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'HTTP status code returned by Prithvi.  Null when the network call itself fails.',
    example: 200,
  })
  @Prop({ required: false, type: Number, default: null })
  httpStatus: number | null;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Sanitised response body.  Raw token strings are replaced with "[REDACTED]".',
  })
  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: null })
  responseBody: Record<string, unknown> | null;

  // ── Outcome ────────────────────────────────────────────────────────────────

  @ApiProperty({
    description: 'Whether the call completed successfully end-to-end.',
    example: true,
  })
  @Prop({ required: true, type: Boolean, index: true })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Human-readable error description when success=false.',
  })
  @Prop({ required: false, type: String, default: null })
  errorMessage: string | null;

  // ── Performance ────────────────────────────────────────────────────────────

  @ApiProperty({
    description: 'Wall-clock time in milliseconds for the outbound HTTP round-trip.',
    example: 142,
  })
  @Prop({ required: true, type: Number })
  durationMs: number;

  // ── Metadata ───────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'True when PRITHVI_ACTIVE_MODE is off; the call was simulated without hitting the real API.',
    example: false,
  })
  @Prop({ required: true, type: Boolean, default: false })
  isDryRun: boolean;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const PrithviApiLogSchema = SchemaFactory.createForClass(PrithviApiLog);

PrithviApiLogSchema.index({ createdAt: -1 });
PrithviApiLogSchema.index({ callType: 1, createdAt: -1 });
PrithviApiLogSchema.index({ success: 1, createdAt: -1 });

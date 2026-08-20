import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import * as mongoose from 'mongoose';

import type { PrithviAgentCurrencyRate } from 'src/services/prithvi-exchange/prithvi-exchange.types';

export type PrithviAgentRatesCacheDocument =
  HydratedDocument<PrithviAgentRatesCache>;

/**
 * Latest agent FX rates snapshot fetched from Prithvi.
 * Updated by scheduled cron (every 5 minutes), not on every API request.
 */
@Schema({ collection: 'prithvi_agent_rates_cache', timestamps: true })
export class PrithviAgentRatesCache {
  @ApiProperty({
    description: 'Prithvi agent UUID this snapshot belongs to.',
    example: 'a297ded2-9df0-4a48-a774-d9149a2bd954',
  })
  @Prop({ required: true, type: String, unique: true, index: true })
  agentId: string;

  @ApiPropertyOptional({ example: 'Agent rates fetched from cache' })
  @Prop({ required: false, type: String, default: null })
  message: string | null;

  @ApiPropertyOptional({ example: 'redis' })
  @Prop({ required: false, type: String, default: null })
  source: string | null;

  @ApiProperty({ example: '2026-07-13T04:29:04.577Z' })
  @Prop({ required: true, type: String })
  providerTimestamp: string;

  @ApiProperty({
    description: 'When this snapshot was last fetched from Prithvi.',
  })
  @Prop({ required: true, type: Date, index: true })
  fetchedAt: Date;

  @ApiProperty({
    type: 'array',
    description: 'All currencies returned by the Prithvi rates API.',
  })
  @Prop({ required: true, type: mongoose.Schema.Types.Mixed })
  currencies: PrithviAgentCurrencyRate[];

  @ApiProperty({ example: false })
  @Prop({ required: true, type: Boolean, default: false })
  isDryRun: boolean;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const PrithviAgentRatesCacheSchema = SchemaFactory.createForClass(
  PrithviAgentRatesCache,
);

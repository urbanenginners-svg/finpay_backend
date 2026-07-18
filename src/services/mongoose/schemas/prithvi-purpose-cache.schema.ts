import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import * as mongoose from 'mongoose';

import type { PrithviPurpose } from 'src/services/prithvi-exchange/prithvi-exchange.types';

export type PrithviPurposeCacheDocument =
  HydratedDocument<PrithviPurposeCache>;

/**
 * Snapshot of Prithvi LRS purpose list.
 * Refreshed monthly by cron (and on startup when empty), not on every API request.
 */
@Schema({ collection: 'prithvi_purpose_cache', timestamps: true })
export class PrithviPurposeCache {
  @ApiProperty({
    description: 'Singleton cache key — only one purpose snapshot is kept.',
    example: 'default',
  })
  @Prop({ required: true, type: String, unique: true, index: true })
  cacheKey: string;

  @ApiProperty({
    description: 'When this snapshot was last fetched from Prithvi.',
  })
  @Prop({ required: true, type: Date, index: true })
  fetchedAt: Date;

  @ApiProperty({
    type: 'array',
    description: 'All purposes returned by the Prithvi /purpose API.',
  })
  @Prop({ required: true, type: [mongoose.Schema.Types.Mixed], default: [] })
  purposes: PrithviPurpose[];

  @ApiProperty({ example: false })
  @Prop({ required: true, type: Boolean, default: false })
  isDryRun: boolean;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export const PrithviPurposeCacheSchema =
  SchemaFactory.createForClass(PrithviPurposeCache);

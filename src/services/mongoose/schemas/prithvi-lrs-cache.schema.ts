import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type PrithviLrsCacheDocument = HydratedDocument<PrithviLrsCache>;

/**
 * Cached Prithvi Lead System LRS check per PAN.
 * Fresh results are reused for 24 hours to avoid repeat provider calls.
 */
@Schema({ collection: 'prithvi_lrs_cache', timestamps: true })
export class PrithviLrsCache {
  @ApiProperty({ example: 'ABCPV1234D' })
  @Prop({ required: true, type: String, unique: true, index: true, uppercase: true })
  pan: string;

  @ApiProperty({ description: 'When this snapshot was fetched from Prithvi (or dry-run).' })
  @Prop({ required: true, type: Date, index: true })
  fetchedAt: Date;

  @ApiProperty({ description: 'Cache expiry — after this, Prithvi is called again.' })
  @Prop({ required: true, type: Date, index: true })
  expiresAt: Date;

  @ApiProperty({ example: true })
  @Prop({ required: true, type: Boolean, default: true })
  success: boolean;

  @ApiPropertyOptional({ example: '2026-09-17 15:05:32.734' })
  @Prop({ type: String, default: null })
  reportDate: string | null;

  @ApiPropertyOptional({ example: 'USD' })
  @Prop({ type: String, default: null })
  currency: string | null;

  @ApiPropertyOptional({ example: 250000 })
  @Prop({ type: Number, default: null })
  limit: number | null;

  @ApiPropertyOptional()
  @Prop({ type: String, default: null })
  totalRemittance: string | null;

  @ApiPropertyOptional({
    description: 'Numeric prior remittance INR when available; otherwise null.',
  })
  @Prop({ type: Number, default: null })
  totalRemittanceInINR: number | null;

  @ApiPropertyOptional()
  @Prop({ type: String, default: null })
  totalRemittanceInINRRaw: string | null;

  @ApiPropertyOptional({ example: 'NFINMAS' })
  @Prop({ type: String, default: null })
  category: string | null;

  @ApiProperty({ example: false })
  @Prop({ required: true, type: Boolean, default: false })
  detailsAvailable: boolean;

  @ApiProperty({ example: false })
  @Prop({ required: true, type: Boolean, default: false })
  isDryRun: boolean;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export const PrithviLrsCacheSchema =
  SchemaFactory.createForClass(PrithviLrsCache);

/** Auto-delete expired cache rows shortly after expiry. */
PrithviLrsCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

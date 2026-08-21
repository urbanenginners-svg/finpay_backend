import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type PrithviForexOrderDocument = HydratedDocument<PrithviForexOrder>;

/**
 * Local copy of a Prithvi forex line order.
 * Created on book (initiate/complete), refreshed every 30 minutes from the Prithvi
 * orders dashboard, and served by GET /remittance/forex/orders/dashboard.
 */
@Schema({ collection: 'prithvi_forex_orders', timestamps: true })
export class PrithviForexOrder {
  @ApiProperty({
    description: 'Prithvi order line id (unique).',
    example: '56a3d0a4-4278-462a-8c8a-9bdc68b8bb3b',
  })
  @Prop({ required: true, type: String, unique: true, index: true })
  prithviOrderId: string;

  @ApiProperty({
    description: 'Parent Prithvi forex request id.',
    example: '6dff8510-dbff-46af-af54-48ac079ca805',
  })
  @Prop({ required: true, type: String, index: true })
  forexRequestId: string;

  @ApiProperty({
    description: 'Finpay user who created the booking (users._id string).',
    example: 'user::0d9b0a0a-7f7c-4e04-9f6f-4b2b1a097ed5',
  })
  @Prop({ required: true, type: String, ref: 'User', index: true })
  createdByUserId: string;

  @ApiPropertyOptional({ example: '202607182232-6381' })
  @Prop({ required: false, type: String, default: null })
  orderCode?: string | null;

  @ApiPropertyOptional({ example: 'Buy' })
  @Prop({ required: false, type: String, default: null })
  orderType?: string | null;

  @ApiPropertyOptional({ example: 'USD' })
  @Prop({ required: false, type: String, default: null })
  currency?: string | null;

  @ApiPropertyOptional({ example: 'CASH' })
  @Prop({ required: false, type: String, default: null, index: true })
  product?: string | null;

  @ApiProperty({
    description:
      'Status code (DRAFT / PENDING / APPROVED / DOCUMENTS_APPROVED_AWAITING_FUNDS / …).',
    example: 'PENDING',
  })
  @Prop({ required: true, type: String, index: true })
  status: string;

  @ApiPropertyOptional({ example: 'Pending Approval' })
  @Prop({ required: false, type: String, default: null })
  statusLabel?: string | null;

  @ApiPropertyOptional({ example: 'NOT_PAID' })
  @Prop({ required: false, type: String, default: null })
  paymentStatus?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  currencyAmount?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  amountInINR?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  sellingRate?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  agentSellingRate?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  gst?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  serviceCharge?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  totalAmount?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  paidAmount?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  pendingAmount?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  travelerName?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  phoneNumber?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  email?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  panNumber?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  purpose?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @Prop({ required: false, type: [String], default: [] })
  travelingCountries?: string[];

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  deliveryAddress?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  pincode?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  sourceOfFunds?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  preferredDeliveryMode?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  preferredPaymentMode?: string | null;

  @ApiPropertyOptional({
    description: 'Travelling start date (YYYY-MM-DD) from complete payload.',
  })
  @Prop({ required: false, type: String, default: null })
  startDate?: string | null;

  @ApiPropertyOptional({
    description: 'Travelling end date (YYYY-MM-DD) from complete payload.',
  })
  @Prop({ required: false, type: String, default: null })
  endDate?: string | null;

  @ApiPropertyOptional({
    description:
      'Prithvi document storage paths keyed by documentType (e.g. passportFrontImage).',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @Prop({ required: false, type: Object, default: {} })
  documents?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Finpay S3 file ids keyed by documentType (local copy).',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @Prop({ required: false, type: Object, default: {} })
  localDocumentFileIds?: Record<string, string>;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String, default: null })
  sessionId?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: Date, default: null })
  sessionExpiresAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Order created_at from Prithvi.',
  })
  @Prop({ required: false, type: Date, default: null, index: true })
  providerCreatedAt?: Date | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: Date, default: null })
  providerUpdatedAt?: Date | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: Date, default: null })
  initiatedAt?: Date | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: Date, default: null })
  completedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Last successful 30-minute dashboard sync.',
  })
  @Prop({ required: false, type: Date, default: null })
  lastSyncedAt?: Date | null;

  @ApiProperty({ example: false })
  @Prop({ required: true, type: Boolean, default: false })
  isDryRun: boolean;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export const PrithviForexOrderSchema =
  SchemaFactory.createForClass(PrithviForexOrder);

PrithviForexOrderSchema.index({ createdByUserId: 1, providerCreatedAt: -1 });
PrithviForexOrderSchema.index({ createdByUserId: 1, status: 1 });
PrithviForexOrderSchema.index({ createdByUserId: 1, product: 1 });

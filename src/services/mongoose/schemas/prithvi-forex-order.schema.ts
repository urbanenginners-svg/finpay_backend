import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

import { ForexBookingSourceEnum } from 'src/utils/enums/forex-booking-source.enum';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';

export type PrithviForexOrderDocument = HydratedDocument<PrithviForexOrder>;

/**
 * Finpay forex order (vendor-agnostic collection).
 * Created on book (initiate/complete), refreshed periodically from the active
 * vendor dashboard, and served by GET /remittance/forex/orders/dashboard.
 *
 * Users only see Finpay; `vendor` records which fulfillment partner processed the
 * order (e.g. prithvi) so multiple vendors can share this collection.
 */
@Schema({ collection: 'forex_orders', timestamps: true })
export class PrithviForexOrder {
  @ApiProperty({
    description:
      'Fulfillment vendor that processed this order behind Finpay (internal; not shown to end users).',
    enum: RemittanceProvider,
    example: RemittanceProvider.PRITHVI,
  })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(RemittanceProvider),
    default: RemittanceProvider.PRITHVI,
    index: true,
  })
  vendor: RemittanceProvider;

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

  @ApiPropertyOptional({
    description:
      'self = customer booked for themselves; agent = agent booked for a walk-in customer (no Finpay account).',
    enum: ForexBookingSourceEnum,
    example: ForexBookingSourceEnum.SELF,
  })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(ForexBookingSourceEnum),
    default: ForexBookingSourceEnum.SELF,
    index: true,
  })
  bookingSource?: ForexBookingSourceEnum;

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

  /** Y — vendor rate snapshot at booking (agent orders only). */
  @ApiPropertyOptional({ example: 20 })
  @Prop({ required: false, type: Number, default: null, index: true })
  vendorRate?: number | null;

  /** X — Finpay→agent sell rate snapshot at booking. */
  @ApiPropertyOptional({ example: 25 })
  @Prop({ required: false, type: Number, default: null })
  finpaySellRate?: number | null;

  /** Card rate ceiling snapshot at booking. */
  @ApiPropertyOptional({ example: 30 })
  @Prop({ required: false, type: Number, default: null })
  cardRate?: number | null;

  /** Z — rate agent sold to customer. */
  @ApiPropertyOptional({ example: 28 })
  @Prop({ required: false, type: Number, default: null })
  customerSellRate?: number | null;

  @ApiPropertyOptional({ example: 5 })
  @Prop({ required: false, type: Number, default: null })
  finpayCommissionPerUnit?: number | null;

  @ApiPropertyOptional({ example: 3 })
  @Prop({ required: false, type: Number, default: null })
  agentCommissionPerUnit?: number | null;

  /** Denormalized total — indexed for commission list/export aggregations. */
  @ApiPropertyOptional({ example: 5000 })
  @Prop({ required: false, type: Number, default: null, index: true })
  finpayCommissionTotal?: number | null;

  @ApiPropertyOptional({ example: 3000 })
  @Prop({ required: false, type: Number, default: null, index: true })
  agentCommissionTotal?: number | null;

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

  @ApiPropertyOptional({
    description:
      'Remitter / customer first name (from profile for self-bookings; from agent customer for agent bookings).',
  })
  @Prop({ required: false, type: String, default: null })
  remitterFirstName?: string | null;

  @ApiPropertyOptional({
    description:
      'Agent walk-in customer id (agent_customers._id) when bookingSource=agent. Not a Finpay user id.',
  })
  @Prop({ required: false, type: String, default: null, index: true })
  agentCustomerId?: string | null;

  @ApiPropertyOptional({ description: 'Remitter last name (from user profile at booking).' })
  @Prop({ required: false, type: String, default: null })
  remitterLastName?: string | null;

  @ApiPropertyOptional({ description: 'Remitter date of birth (YYYY-MM-DD).' })
  @Prop({ required: false, type: String, default: null })
  remitterDateOfBirth?: string | null;

  @ApiPropertyOptional({ description: 'Remitter residential address.' })
  @Prop({ required: false, type: String, default: null })
  remitterAddress?: string | null;

  @ApiPropertyOptional({ description: 'Remitter city.' })
  @Prop({ required: false, type: String, default: null })
  remitterCity?: string | null;

  @ApiPropertyOptional({ description: 'Remitter state (Indian state name).' })
  @Prop({ required: false, type: String, default: null })
  remitterState?: string | null;

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

  @ApiPropertyOptional({
    description: 'User submitted offline bank transfer for this order.',
  })
  @Prop({ required: false, type: Boolean, default: false })
  offlinePayment?: boolean;

  @ApiPropertyOptional({ example: 'NEFT' })
  @Prop({ required: false, type: String, default: null })
  offlinePaymentMode?: string | null;

  @ApiPropertyOptional({ example: 'HDFCN26083112345' })
  @Prop({ required: false, type: String, default: null })
  offlineUtrNumber?: string | null;

  @ApiPropertyOptional({ description: 'Finpay S3 file id for payment receipt.' })
  @Prop({ required: false, type: String, default: null })
  paymentStatementReceiptLocalFileId?: string | null;

  @ApiPropertyOptional({ description: 'Prithvi S3 key for payment receipt.' })
  @Prop({ required: false, type: String, default: null })
  paymentStatementReceiptPrithviKey?: string | null;

  @ApiPropertyOptional({ description: 'Prithvi receipt URL (may expire).' })
  @Prop({ required: false, type: String, default: null })
  paymentStatementReceiptUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Prithvi S3 key for SWIFT copy document (synced from dashboard).',
  })
  @Prop({ required: false, type: String, default: null })
  swiftCopyDoc?: string | null;

  @ApiPropertyOptional({
    description: 'Prithvi presigned URL for SWIFT copy (may expire; refreshed on sync).',
  })
  @Prop({ required: false, type: String, default: null })
  swiftCopyDocUrl?: string | null;

  @ApiPropertyOptional()
  @Prop({ required: false, type: Date, default: null })
  offlinePaymentSubmittedAt?: Date | null;

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

PrithviForexOrderSchema.index({ vendor: 1, createdByUserId: 1, providerCreatedAt: -1 });
PrithviForexOrderSchema.index({ createdByUserId: 1, providerCreatedAt: -1 });
PrithviForexOrderSchema.index({ createdByUserId: 1, status: 1 });
PrithviForexOrderSchema.index({ createdByUserId: 1, product: 1 });
/** Agent commission ledger — hot path for agent dashboard + CSV. */
PrithviForexOrderSchema.index({
  bookingSource: 1,
  createdByUserId: 1,
  providerCreatedAt: -1,
});
PrithviForexOrderSchema.index({
  bookingSource: 1,
  providerCreatedAt: -1,
  agentCommissionTotal: 1,
});

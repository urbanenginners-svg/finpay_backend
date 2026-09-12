import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type CustomerCardRateDocument = HydratedDocument<CustomerCardRate>;

/**
 * Global per-currency retail rates for registered customers (userType=user).
 *
 * y = live TT buy rate from Prithvi (not entered by admin)
 * c = finpayCommission — admin-configured Finpay markup over live TT
 * x = finpaySellRate = y + c — rate customers see and pay; recomputed on read
 * cardRate / IBR     — always live TT + 3%; recomputed whenever Y changes
 *
 * Independent of agent_card_rates (per-agent B2B).
 */
@Schema({ collection: 'customer_card_rates', timestamps: true })
export class CustomerCardRate {
  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code.' })
  @Prop({ required: true, type: String, uppercase: true, trim: true, unique: true })
  currency: string;

  @ApiProperty({
    example: 20,
    description: 'Y — live TT snapshot at last save (INR per unit).',
    default: 0,
  })
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  vendorRate: number;

  @ApiProperty({
    example: 1.5,
    description:
      'Finpay commission over live TT (INR per unit). Customer rate X = live TT + this.',
    default: 0,
  })
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  finpayCommission: number;

  @ApiProperty({
    example: 25,
    description:
      'X — retail sell rate to customers (INR per unit). Snapshot of live TT + commission at save; reads recompute.',
    default: 0,
  })
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  finpaySellRate: number;

  @ApiProperty({
    example: 30,
    description:
      'Card rate / IBR — always live TT (Y) + 3%. Stored as a snapshot; reads recompute from live TT.',
    default: 0,
  })
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  cardRate: number;

  @ApiPropertyOptional({ description: 'Admin user id who last updated this row.' })
  @Prop({ required: false, type: String, default: null })
  updatedByAdminId?: string | null;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export const CustomerCardRateSchema =
  SchemaFactory.createForClass(CustomerCardRate);

CustomerCardRateSchema.index({ currency: 1 }, { unique: true });

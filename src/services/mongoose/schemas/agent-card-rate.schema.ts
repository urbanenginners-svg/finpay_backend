import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type AgentCardRateDocument = HydratedDocument<AgentCardRate>;

/**
 * Per-agent, per-currency commercial rates set by admin.
 *
 * y = live TT buy rate from Prithvi (not entered by admin)
 * c = finpayCommission — admin-configured Finpay markup over live TT
 * x = finpaySellRate = y + c — always recomputed from live TT on read/booking
 * cardRate / IBR     — always live TT + 3%; recomputed whenever Y changes
 *
 * vendorRate / finpaySellRate / cardRate on this collection are last-seen
 * snapshots at save. Reads and bookings always overlay the current live TT.
 *
 * Defaults are 0 until admin configures commission.
 */
@Schema({ collection: 'agent_card_rates', timestamps: true })
export class AgentCardRate {
  @ApiProperty({ description: 'Finpay agent user id (users._id).' })
  @Prop({ required: true, type: String, ref: 'User', index: true })
  agentId: string;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code.' })
  @Prop({ required: true, type: String, uppercase: true, trim: true })
  currency: string;

  @ApiProperty({
    example: 20,
    description: 'Y — rate Finpay receives from third-party vendor (INR per unit).',
    default: 0,
  })
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  vendorRate: number;

  @ApiProperty({
    example: 1.5,
    description:
      'Finpay commission over live TT (INR per unit). Agent rate X = live TT + this.',
    default: 0,
  })
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  finpayCommission: number;

  @ApiProperty({
    example: 25,
    description:
      'X — Finpay sell rate to agent (INR per unit). Snapshot of live TT + finpayCommission at save; reads recompute.',
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

export const AgentCardRateSchema = SchemaFactory.createForClass(AgentCardRate);

AgentCardRateSchema.index({ agentId: 1, currency: 1 }, { unique: true });
AgentCardRateSchema.index({ currency: 1 });

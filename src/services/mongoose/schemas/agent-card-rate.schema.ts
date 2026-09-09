import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type AgentCardRateDocument = HydratedDocument<AgentCardRate>;

/**
 * Per-agent, per-currency commercial rates set by admin.
 *
 * y = live TT buy rate from Prithvi (not entered by admin)
 * x = finpaySellRate — Finpay sell price to the agent
 * cardRate / IBR     — always live TT + 3%; recomputed whenever Y changes
 *
 * vendorRate and cardRate on this collection are last-seen snapshots at save.
 * Reads and bookings always overlay the current live TT cache.
 *
 * Defaults are 0 until admin configures X.
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
    example: 25,
    description: 'X — rate Finpay sells this currency to the agent (INR per unit).',
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

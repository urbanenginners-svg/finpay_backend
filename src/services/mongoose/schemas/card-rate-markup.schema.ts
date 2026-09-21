import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type CardRateMarkupDocument = HydratedDocument<CardRateMarkup>;

/**
 * Per-currency card-rate / IBR markup over (live TT − paise offset).
 * Defaults to 3% when no row exists for a currency.
 */
@Schema({ collection: 'card_rate_markups', timestamps: true })
export class CardRateMarkup {
  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code.' })
  @Prop({
    required: true,
    type: String,
    uppercase: true,
    trim: true,
    unique: true,
  })
  currency: string;

  @ApiProperty({
    example: 3,
    description:
      'Markup percent applied to (live TT − ttPaiseOffset) to compute card rate / IBR.',
    default: 3,
  })
  @Prop({ required: true, type: Number, default: 3, min: 0 })
  markupPercent: number;

  @ApiPropertyOptional({ description: 'Admin user id who last updated this row.' })
  @Prop({ required: false, type: String, default: null })
  updatedByAdminId?: string | null;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export const CardRateMarkupSchema = SchemaFactory.createForClass(CardRateMarkup);

CardRateMarkupSchema.index({ currency: 1 }, { unique: true });

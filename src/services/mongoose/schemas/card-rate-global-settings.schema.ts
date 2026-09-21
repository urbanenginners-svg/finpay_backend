import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type CardRateGlobalSettingsDocument =
  HydratedDocument<CardRateGlobalSettings>;

export const CARD_RATE_SETTINGS_KEY = 'default';

/**
 * Global card-rate settings (singleton).
 * ttPaiseOffset is subtracted from live TT before applying markup %.
 */
@Schema({ collection: 'card_rate_global_settings', timestamps: true })
export class CardRateGlobalSettings {
  @ApiProperty({ example: 'default', description: 'Singleton document key.' })
  @Prop({ required: true, type: String, unique: true, default: CARD_RATE_SETTINGS_KEY })
  key: string;

  @ApiProperty({
    example: 0.08,
    description:
      'Amount (INR) subtracted from live TT before card-rate markup. Default 8 paise = ₹0.08.',
    default: 0.08,
  })
  @Prop({ required: true, type: Number, default: 0.08, min: 0 })
  ttPaiseOffset: number;

  @ApiPropertyOptional({ description: 'Admin user id who last updated this row.' })
  @Prop({ required: false, type: String, default: null })
  updatedByAdminId?: string | null;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export const CardRateGlobalSettingsSchema = SchemaFactory.createForClass(
  CardRateGlobalSettings,
);

CardRateGlobalSettingsSchema.index({ key: 1 }, { unique: true });

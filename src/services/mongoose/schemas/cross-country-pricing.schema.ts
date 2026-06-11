import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

import commonFieldsPlugin from '../plugins/common-fields';

export type CrossCountryPricingDocument = CrossCountryPricing & Document;

@Schema({ collection: 'cross_country_pricing', timestamps: true })
export class CrossCountryPricing {
  @ApiProperty()
  @Prop({ required: true, type: String, unique: true })
  _id?: string;

  @ApiProperty({ required: false })
  referenceNumber?: string;

  @ApiProperty({ example: 'India' })
  @Prop({ required: true, type: String })
  countryAName: string;

  @ApiProperty({ example: 'United States' })
  @Prop({ required: true, type: String })
  countryBName: string;

  @ApiProperty({ example: 'INR' })
  @Prop({ required: true, type: String, uppercase: true, trim: true })
  countryACurrency: string;

  @ApiProperty({ example: 'USD' })
  @Prop({ required: true, type: String, uppercase: true, trim: true })
  countryBCurrency: string;

  @ApiProperty({
    example: 0.012,
    description: 'A→B rate: 1 unit of country A currency = this many units of country B currency',
  })
  @Prop({ required: true, type: Number, min: 0 })
  countryAPricing: number;

  @ApiProperty({
    example: 83.5,
    description: 'B→A rate: 1 unit of country B currency = this many units of country A currency',
  })
  @Prop({ required: true, type: Number, min: 0 })
  countryBPricing: number;

  @ApiProperty({ example: true, default: true })
  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const CrossCountryPricingSchema =
  SchemaFactory.createForClass(CrossCountryPricing);

CrossCountryPricingSchema.plugin(commonFieldsPlugin, {
  name: CrossCountryPricing.name,
});

CrossCountryPricingSchema.index(
  { countryAName: 1, countryBName: 1 },
  { unique: true },
);

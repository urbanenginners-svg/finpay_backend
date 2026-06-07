import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';

export type RemittanceProviderTokenDocument =
  HydratedDocument<RemittanceProviderToken>;

/**
 * Shared OAuth token store for remittance service providers.
 * One document per provider (e.g. prithvi); additional providers
 * reuse this collection with a different `provider` value.
 */
@Schema({ collection: 'remittance_provider_tokens', timestamps: true })
export class RemittanceProviderToken {
  @ApiProperty({ enum: RemittanceProvider, example: RemittanceProvider.PRITHVI })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(RemittanceProvider),
    unique: true,
    index: true,
  })
  provider: RemittanceProvider;

  @Prop({ required: true, type: String, select: false })
  accessToken: string;

  @Prop({ required: true, type: String, select: false })
  refreshToken: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ required: false, type: String, default: 'Bearer' })
  tokenType?: string;

  @Prop({ required: false, type: String })
  scope?: string;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const RemittanceProviderTokenSchema = SchemaFactory.createForClass(
  RemittanceProviderToken,
);

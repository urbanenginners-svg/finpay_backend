import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type SystemApiKeyDocument = HydratedDocument<SystemApiKey>;

/**
 * Mirrors the `systemApiKey` collection owned by ctrl-rest.
 * Both services share the same MongoDB, so this service reads
 * the collection directly rather than going through an HTTP hop.
 *
 * Field contract (kept in sync with ctrl-rest's SystemApiKey schema):
 *  - publicKey   – "ctrlpub_" + 32 hex chars, indexed + unique
 *  - secretHash  – bcrypt hash (cost 12) of the plaintext secret
 *  - isActive    – soft enable/disable flag
 *  - expiresAt   – hard expiry; null means never-expiring
 *  - organizationId – owning org reference
 *  - name        – human-readable label
 */
@Schema({ collection: 'systemApiKey', timestamps: true })
export class SystemApiKey {
  @ApiProperty({ example: 'ctrlpub_abc123...', description: 'Public key identifier' })
  @Prop({ required: true, type: String, unique: true, index: true })
  publicKey: string;

  @ApiProperty({ description: 'bcrypt hash (cost 12) of the plaintext secret' })
  @Prop({ required: true, type: String, select: false })
  secretHash: string;

  @ApiProperty({ description: 'Plaintext secret' })
  @Prop({ required: true, type: String })
  plainSecret: string;

  @ApiProperty({ example: true })
  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ required: false, type: Date, default: null })
  expiresAt?: Date | null;

  @ApiProperty({ example: 'My Integration Key' })
  @Prop({ required: false, type: String, trim: true })
  name?: string;

  @ApiProperty({ description: 'User _id whose identity is assumed when this key authenticates a request' })
  @Prop({ required: false, type: String, ref: 'User' })
  linkedUserId?: string;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const SystemApiKeySchema = SchemaFactory.createForClass(SystemApiKey);

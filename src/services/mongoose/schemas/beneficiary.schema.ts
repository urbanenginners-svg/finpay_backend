import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type BeneficiaryDocument = HydratedDocument<Beneficiary>;

@Schema({ collection: 'beneficiaries', timestamps: true })
export class Beneficiary {
  @ApiProperty({
    description: 'Finpay user who owns this beneficiary (users._id string).',
  })
  @Prop({ required: true, type: String, ref: 'User', index: true })
  userId: string;

  @ApiPropertyOptional({
    description:
      'Agent walk-in customer this beneficiary belongs to (agent_customers._id). Required for agent-owned beneficiaries; omitted for Finpay app users.',
  })
  @Prop({
    required: false,
    type: String,
    ref: 'AgentCustomer',
    default: null,
    index: true,
  })
  agentCustomerId?: string | null;

  @ApiProperty({ example: 'John Smith' })
  @Prop({ required: true, type: String, trim: true })
  institutionName: string;

  @ApiProperty({ example: '123 Main St' })
  @Prop({ required: true, type: String, trim: true })
  institutionAddress: string;

  @ApiProperty({ example: 'CHASUS33' })
  @Prop({ required: true, type: String, trim: true })
  swiftCode: string;

  @ApiProperty({ example: '021000021' })
  @Prop({ required: true, type: String, trim: true })
  routingNumber: string;

  @ApiProperty({ example: '1234567890' })
  @Prop({ required: true, type: String, trim: true })
  bankAccountNumber: string;

  @ApiProperty({ example: 'Chase Bank' })
  @Prop({ required: true, type: String, trim: true })
  bankName: string;

  @ApiProperty({ example: '270 Park Avenue, New York' })
  @Prop({ required: true, type: String, trim: true })
  beneficiaryBankAddress: string;

  @ApiPropertyOptional({ example: 'Student ID 11212121' })
  @Prop({ required: false, type: String, default: null, trim: true })
  additionalInfo?: string | null;

  @ApiPropertyOptional({ example: 'Correspondent Bank' })
  @Prop({ required: false, type: String, default: null, trim: true })
  interimBankName?: string | null;

  @ApiPropertyOptional({ example: '1 Bank Plaza' })
  @Prop({ required: false, type: String, default: null, trim: true })
  interimBankAddress?: string | null;

  @ApiPropertyOptional({ example: 'IRVTUS3N' })
  @Prop({ required: false, type: String, default: null, trim: true })
  interimBankCode?: string | null;

  @ApiPropertyOptional({ example: 'Belgium' })
  @Prop({ required: false, type: String, default: null, trim: true })
  interimBankCountry?: string | null;

  @ApiProperty({ example: 'Austria' })
  @Prop({ required: true, type: String, trim: true })
  benCountry: string;

  @ApiProperty({ example: 'Father' })
  @Prop({ required: true, type: String, trim: true })
  beneficiaryRelation: string;

  @ApiProperty({ example: false })
  @Prop({ required: true, type: Boolean, default: false })
  isInterimBankSelected: boolean;

  @ApiPropertyOptional({
    description: 'Prithvi beneficiary UUID returned by POST /beneficiaries.',
    example: 'a297ded2-9df0-4a48-a774-d9149a2bd954',
  })
  @Prop({ required: false, type: String, default: null, trim: true, index: true })
  prithviBeneficiaryId?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BeneficiarySchema = SchemaFactory.createForClass(Beneficiary);

BeneficiarySchema.index({ userId: 1, createdAt: -1 });
BeneficiarySchema.index({ userId: 1, agentCustomerId: 1, createdAt: -1 });

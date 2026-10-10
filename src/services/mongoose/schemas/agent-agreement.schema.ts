import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type AgentAgreementDocument = HydratedDocument<AgentAgreement>;

export const AGENT_AGREEMENT_TEMPLATE_VERSION = 'referral-arrangement-annexure-a-v1';

export enum AgentAgreementStatusEnum {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
}

/** Snapshot of one agent_card_rates row (Finpay commission per currency and purpose). */
@Schema({ _id: false })
export class AgentAgreementCommission {
  @ApiProperty({ example: 'USD' })
  @Prop({ type: String, uppercase: true, trim: true })
  currency: string;

  @ApiProperty({ example: 'S0305', description: 'Empty = default for all other purposes' })
  @Prop({ type: String, trim: true, default: '' })
  purposeCode: string;

  @ApiProperty({ example: 'Education' })
  @Prop({ type: String, trim: true })
  purposeName: string;

  @ApiProperty({ example: 1.5, description: 'INR per unit over live TT' })
  @Prop({ type: Number })
  finpayCommission: number;
}

export const AgentAgreementCommissionSchema = SchemaFactory.createForClass(
  AgentAgreementCommission,
);

@Schema({ _id: false })
export class AgentAgreementDetails {
  @ApiProperty({ example: 'R. K. Enterprises' })
  @Prop({ required: true, type: String, trim: true })
  firmName: string;

  @ApiProperty({ example: 'Ground Floor, Shop No.1, Sunshine Market, Hoshiarpur' })
  @Prop({ required: true, type: String, trim: true })
  firmAddress: string;

  @ApiProperty({ example: 'Rajinder Kumar' })
  @Prop({ required: true, type: String, trim: true })
  signatoryName: string;

  @ApiProperty({ example: 'Authorized Signatory' })
  @Prop({ required: true, type: String, trim: true })
  signatoryDesignation: string;

  @ApiProperty({ example: '2026-09-26' })
  @Prop({ required: true, type: String, trim: true })
  commencementDate: string;

  @ApiProperty({ type: [AgentAgreementCommission] })
  @Prop({ type: [AgentAgreementCommissionSchema], default: [] })
  commissions: AgentAgreementCommission[];
}

export const AgentAgreementDetailsSchema = SchemaFactory.createForClass(
  AgentAgreementDetails,
);

@Schema({ _id: false })
export class AgentAgreementAcceptance {
  @ApiProperty()
  @Prop({ required: true, type: Number })
  version: number;

  @ApiProperty()
  @Prop({ required: true, type: String })
  templateVersion: string;

  @ApiProperty({ type: AgentAgreementDetails, description: 'Details exactly as shown to the agent at acceptance' })
  @Prop({ required: true, type: AgentAgreementDetailsSchema })
  details: AgentAgreementDetails;

  @ApiProperty({ description: 'Full name typed by the agent as their digital signature' })
  @Prop({ required: true, type: String })
  signedName: string;

  @ApiProperty()
  @Prop({ required: true, type: Date })
  acceptedAt: Date;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String })
  ipAddress?: string;

  @ApiPropertyOptional()
  @Prop({ required: false, type: String })
  userAgent?: string;
}

export const AgentAgreementAcceptanceSchema = SchemaFactory.createForClass(
  AgentAgreementAcceptance,
);

/** One agreement per agent; re-issuing bumps `version` and requires fresh acceptance. */
@Schema({ collection: 'agent_agreements', timestamps: true })
export class AgentAgreement {
  @ApiProperty({ description: 'users._id where userType=agent' })
  @Prop({ required: true, type: String, ref: 'User', unique: true })
  agentId: string;

  @ApiProperty({ type: AgentAgreementDetails })
  @Prop({ required: true, type: AgentAgreementDetailsSchema })
  details: AgentAgreementDetails;

  @ApiProperty()
  @Prop({ required: true, type: Number, default: 1 })
  version: number;

  @ApiProperty()
  @Prop({ required: true, type: String, default: AGENT_AGREEMENT_TEMPLATE_VERSION })
  templateVersion: string;

  @ApiProperty({ enum: AgentAgreementStatusEnum })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(AgentAgreementStatusEnum),
    default: AgentAgreementStatusEnum.PENDING,
  })
  status: AgentAgreementStatusEnum;

  @ApiProperty()
  @Prop({ required: true, type: Date })
  issuedAt: Date;

  @ApiProperty()
  @Prop({ required: true, type: String })
  issuedBy: string;

  @ApiPropertyOptional({ type: AgentAgreementAcceptance })
  @Prop({ required: false, type: AgentAgreementAcceptanceSchema, default: null })
  acceptance?: AgentAgreementAcceptance | null;

  @ApiProperty({ type: [AgentAgreementAcceptance], description: 'Acceptances of earlier versions' })
  @Prop({ type: [AgentAgreementAcceptanceSchema], default: [] })
  acceptanceHistory: AgentAgreementAcceptance[];

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const AgentAgreementSchema = SchemaFactory.createForClass(AgentAgreement);

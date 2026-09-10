import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type AgentCustomerDocument = HydratedDocument<AgentCustomer>;

/**
 * Walk-in / CRM customer owned by a Finpay agent.
 * Not a Finpay app user — no login, role, or self-booking account.
 */
@Schema({ collection: 'agent_customers', timestamps: true })
export class AgentCustomer {
  @ApiProperty({
    description: 'Owning Finpay agent (users._id where userType=agent).',
  })
  @Prop({ required: true, type: String, ref: 'User', index: true })
  agentId: string;

  @ApiProperty({ example: 'Jane' })
  @Prop({ required: true, type: String, trim: true })
  firstName: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @Prop({ required: false, type: String, default: null, trim: true })
  lastName?: string | null;

  @ApiProperty({ example: '9876543210' })
  @Prop({ required: true, type: String, trim: true, index: true })
  phoneNumber: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @Prop({ required: true, type: String, trim: true, lowercase: true })
  email: string;

  @ApiProperty({ example: 'ABCDE1234F' })
  @Prop({ required: true, type: String, trim: true, uppercase: true })
  panNumber: string;

  @ApiProperty({ example: '1990-01-15' })
  @Prop({ required: true, type: String, trim: true })
  dateOfBirth: string;

  @ApiProperty({ example: '123 MG Road, Koramangala' })
  @Prop({ required: true, type: String, trim: true })
  address: string;

  @ApiProperty({ example: 'Bengaluru' })
  @Prop({ required: true, type: String, trim: true })
  city: string;

  @ApiProperty({ example: 'Karnataka' })
  @Prop({ required: true, type: String, trim: true })
  state: string;

  @ApiProperty({ example: '560001' })
  @Prop({ required: true, type: String, trim: true })
  pincode: string;

  @ApiPropertyOptional({ example: true, default: false })
  @Prop({ required: true, type: Boolean, default: false })
  panVerified: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AgentCustomerSchema = SchemaFactory.createForClass(AgentCustomer);

AgentCustomerSchema.index({ agentId: 1, createdAt: -1 });
AgentCustomerSchema.index({ agentId: 1, phoneNumber: 1 });
AgentCustomerSchema.index({ agentId: 1, panNumber: 1 });

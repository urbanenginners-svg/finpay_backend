import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

import commonFieldsPlugin from '../plugins/common-fields';
import { ServiceEnquiryType } from 'src/utils/enums/service-enquiry-type.enum';
import { ServiceEnquiryStatus } from 'src/utils/enums/service-enquiry-status.enum';
import { ENQUIRY_SOURCE } from 'src/api/enquiry/constants/enquiry.constants';

@Schema({ _id: false })
export class ServiceEnquiryContact {
  @Prop({ required: true, type: String })
  fullName: string;

  @Prop({ required: true, type: String })
  mobile: string;

  @Prop({ required: true, type: String })
  email: string;

  @Prop({ required: true, type: Boolean, default: false })
  callbackRequested: boolean;
}

@Schema({ _id: true, timestamps: { createdAt: true, updatedAt: false } })
export class ServiceEnquiryAdminNote {
  @Prop({ required: true, type: String })
  content: string;

  @Prop({ required: true, type: String })
  createdByUserId: string;

  @Prop({ required: true, type: String })
  createdByName: string;

  createdAt?: Date;
}

const ServiceEnquiryAdminNoteSchema =
  SchemaFactory.createForClass(ServiceEnquiryAdminNote);

export type ServiceEnquiryDocument = ServiceEnquiry & Document;

@Schema({ collection: 'service_enquiries', timestamps: true })
export class ServiceEnquiry {
  @ApiProperty()
  @Prop({ required: true, type: String, unique: true })
  _id?: string;

  @ApiProperty({ required: false })
  referenceNumber?: string;

  @ApiProperty({ enum: ServiceEnquiryType })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(ServiceEnquiryType),
  })
  serviceType: ServiceEnquiryType;

  @ApiProperty()
  @Prop({ required: true, type: ServiceEnquiryContact })
  contact: ServiceEnquiryContact;

  @ApiProperty({ description: 'Service-specific payload' })
  @Prop({ required: true, type: Object })
  serviceDetails: Record<string, unknown>;

  @ApiProperty({ enum: ServiceEnquiryStatus })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(ServiceEnquiryStatus),
    default: ServiceEnquiryStatus.PENDING,
  })
  status: ServiceEnquiryStatus;

  @ApiProperty({ example: ENQUIRY_SOURCE })
  @Prop({ required: true, type: String, default: ENQUIRY_SOURCE })
  source: string;

  @ApiProperty()
  @Prop({ required: true, type: Boolean, default: false })
  isPriority: boolean;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: Number })
  estimatedInrValue?: number;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: Number })
  fxRateUsed?: number;

  @ApiProperty({ required: false, isArray: true })
  @Prop({ required: false, type: [ServiceEnquiryAdminNoteSchema], default: [] })
  adminNotes: ServiceEnquiryAdminNote[];

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const ServiceEnquirySchema = SchemaFactory.createForClass(ServiceEnquiry);
ServiceEnquirySchema.plugin(commonFieldsPlugin, { name: ServiceEnquiry.name });

ServiceEnquirySchema.index({ serviceType: 1, status: 1, createdAt: -1 });
ServiceEnquirySchema.index({ 'contact.mobile': 1 });
ServiceEnquirySchema.index({ 'contact.email': 1 });

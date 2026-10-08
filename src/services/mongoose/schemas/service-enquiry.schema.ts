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

/** Snapshot of the website visit that produced the lead (only when the visitor consented to analytics). */
@Schema({ _id: false })
export class ServiceEnquiryAttribution {
  @Prop({ type: String })
  visitorId?: string;

  @Prop({ type: String })
  sessionId?: string;

  @Prop({ type: Boolean })
  isNewVisitor?: boolean;

  @Prop({ type: Date })
  sessionStartedAt?: Date;

  @Prop({ type: String })
  source?: string;

  @Prop({ type: String })
  medium?: string;

  @Prop({ type: String })
  channel?: string;

  @Prop({ type: String })
  campaign?: string;

  @Prop({ type: String })
  referrerHost?: string;

  @Prop({ type: String })
  landingPage?: string;

  @Prop({ type: Number })
  pagesBeforeLead?: number;

  @Prop({ type: String })
  country?: string;

  @Prop({ type: String })
  region?: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  deviceType?: string;

  @Prop({ type: String })
  browser?: string;

  @Prop({ type: String })
  os?: string;
}

const ServiceEnquiryAttributionSchema = SchemaFactory.createForClass(ServiceEnquiryAttribution);

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

  @ApiProperty({ required: false, type: ServiceEnquiryAttribution })
  @Prop({ required: false, type: ServiceEnquiryAttributionSchema })
  attribution?: ServiceEnquiryAttribution;

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
ServiceEnquirySchema.index({ createdAt: -1 });
ServiceEnquirySchema.index({ 'attribution.visitorId': 1 }, { sparse: true });

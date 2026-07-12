import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import commonFieldsPlugin from "../plugins/common-fields";
import { ApiProperty } from "@nestjs/swagger";
import { HydratedDocument } from "mongoose";
import { Role } from "./role.schema";
import { RegistrationStatusEnum } from "src/utils/enums/registration-status.enum";
import { AadhaarVerificationStatusEnum } from "src/utils/enums/aadhaar-verification-status.enum";
import { PanVerificationStatusEnum } from "src/utils/enums/pan-verification-status.enum";
import { PassportVerificationStatusEnum } from "src/utils/enums/passport-verification-status.enum";
import { UserTypeEnum } from "src/utils/enums/user-type.enum";

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class PrivateLimitedDocuments {
  @Prop({ type: String, ref: 'File' })
  moaAoa?: string;

  @Prop({ type: String, ref: 'File' })
  certificateOfIncorporation?: string;

  @Prop({ type: String, ref: 'File' })
  gstCertificate?: string;

  @Prop({ type: String, ref: 'File' })
  addressProof?: string;

  @Prop({ type: String, ref: 'File' })
  companyPanCard?: string;

  @Prop({ type: String, ref: 'File' })
  bankCancelCheque?: string;
}

export const PrivateLimitedDocumentsSchema =
  SchemaFactory.createForClass(PrivateLimitedDocuments);

@Schema({ _id: false })
export class AgentDocuments {
  @Prop({ type: String, ref: 'File' })
  udhyamAadhaarCertificate?: string;

  @Prop({ type: String, ref: 'File' })
  bankCancelCheque?: string;

  @Prop({ type: String, ref: 'File' })
  gstCertificate?: string;

  @Prop({ type: Boolean, default: false })
  isPrivateLimited?: boolean;

  @Prop({ type: PrivateLimitedDocumentsSchema })
  privateLimitedDocuments?: PrivateLimitedDocuments;
}

export const AgentDocumentsSchema = SchemaFactory.createForClass(AgentDocuments);

@Schema({ collection: "users" })
export class User {
  @ApiProperty()
  @Prop({
    required: true,
    type: String,
    unique: true,
  })
  _id: string;

  @ApiProperty()
  @Prop()
  firstName: string;

  @ApiProperty({ required: false })
  @Prop({ required: false })
  lastName?: string;

  @ApiProperty({
    required: false,
    example: 'user@example.com',
  })
  @Prop({
    required: false,
    unique: true,
    sparse: true,
  })
  email: string;

  @ApiProperty()
  @Prop({
    sparse: true,
  })
  phoneNumber: string;

  @ApiProperty({
    required: false,
    description: 'Stable user identifier from an external system',
  })
  @Prop({
    required: false,
    type: String,
    trim: true,
    sparse: true,
  })
  externalUserId?: string;

  @Prop({ select: false })
  otp: string;

  @Prop()
  otpExpiresAt: Date;

  @ApiProperty({ required: false })
  @Prop({
    required: false,
    type: String,
    ref: 'File',
  })
  profilePic?: string;

  @ApiProperty()
  @Prop({
    required: false,
  })
  password: string;

  @ApiProperty({ type: String })
  @Prop({
    type: String,
    ref: "Role",
  })
  role: string | Role;

  @ApiProperty()
  @Prop({
    required: true,
    type: Boolean,
    default: true,
  })
  isActive: boolean;

  @ApiProperty({ enum: UserTypeEnum, required: false })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(UserTypeEnum),
  })
  userType?: UserTypeEnum;

  @ApiProperty({ enum: RegistrationStatusEnum, required: false })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(RegistrationStatusEnum),
    default: RegistrationStatusEnum.VERIFIED,
  })
  registrationStatus?: RegistrationStatusEnum;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: Date })
  dateOfBirth?: Date;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: String })
  aadhaarNumber?: string;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: String })
  panCardNumber?: string;

  @ApiProperty({ enum: AadhaarVerificationStatusEnum, required: false })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(AadhaarVerificationStatusEnum),
  })
  aadhaarVerificationStatus?: AadhaarVerificationStatusEnum;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: String })
  aadhaarVerificationRef?: string;

  @ApiProperty({ enum: PanVerificationStatusEnum, required: false })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(PanVerificationStatusEnum),
  })
  panVerificationStatus?: PanVerificationStatusEnum;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: String })
  panVerificationRef?: string;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: String })
  passportFileNumber?: string;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: String })
  passportNumber?: string;

  @ApiProperty({ enum: PassportVerificationStatusEnum, required: false })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(PassportVerificationStatusEnum),
  })
  passportVerificationStatus?: PassportVerificationStatusEnum;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: String })
  passportVerificationRef?: string;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: AgentDocumentsSchema })
  agentDocuments?: AgentDocuments;

  @ApiProperty({ required: false })
  @Prop({ required: false, type: String })
  rejectionReason?: string;

  @ApiProperty()
  @Prop({
    required: false,
    type: String,
  })
  createdBy?: string;

  @ApiProperty()
  @Prop({
    required: false,
    type: String,
  })
  lastUpdatedBy?: string;

  @ApiProperty()
  @Prop({
    required: false,
    type: String,
  })
  deletedBy?: string;

  @ApiProperty()
  @Prop({
    required: false,
    type: Date,
  })
  deletedAt?: Date;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.plugin(commonFieldsPlugin, { name: User.name });
UserSchema.index({ externalUserId: 1 }, { unique: true, sparse: true });

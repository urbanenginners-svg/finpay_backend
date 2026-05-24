import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

import commonFieldsPlugin from '../plugins/common-fields';
import { FileResourceEnum } from 'src/utils/enums/file-resource.enum';
import {
  DocumentType,
  IdProofType,
  AddressProofType,
} from 'src/utils/enums/document-type.enum';

export type FileDocument = File & Document;

@Schema({ collection: 'files', timestamps: true })
export class File {
  @ApiProperty()
  @Prop({
    required: true,
    type: String,
    unique: true,
  })
  _id?: string;

  @ApiProperty({
    description: 'S3 URL of the uploaded file',
    example: 'https://my-bucket.s3.amazonaws.com/vendor/abc.jpg',
  })
  @Prop({
    required: true,
    type: String,
  })
  imageUrl: string;

  @ApiProperty({
    description: 'S3 key (object key) of the file in the bucket',
    example: 'vendor/2024/abc.jpg',
  })
  @Prop({
    required: true,
    type: String,
  })
  s3Key: string;

  @ApiProperty({
    description: 'Original file name at the time of upload',
    example: 'profile-photo.jpg',
  })
  @Prop({
    required: false,
    type: String,
  })
  originalName?: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
  })
  @Prop({
    required: false,
    type: String,
  })
  mimeType?: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 204800,
  })
  @Prop({
    required: false,
    type: Number,
  })
  size?: number;

  @ApiProperty({
    enum: FileResourceEnum,
    description: 'The resource/entity type this file belongs to',
    example: FileResourceEnum.VENDOR,
  })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(FileResourceEnum),
  })
  type: FileResourceEnum;

  @ApiProperty({
    description: 'Optional reference ID of the entity this file is associated with',
    example: 'vendor::123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @Prop({
    required: false,
    type: String,
  })
  referenceId?: string;

  @ApiProperty({
    enum: DocumentType,
    description: 'Document classification (idProof | societyAgreement | addressProof)',
    required: false,
  })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(DocumentType),
  })
  documentType?: DocumentType;

  @ApiProperty({
    enum: IdProofType,
    description: 'ID proof sub-type (aadhaar | voter-card)',
    required: false,
  })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(IdProofType),
  })
  idType?: IdProofType;

  @ApiProperty({
    enum: AddressProofType,
    description: 'Address proof sub-type (aadhaar | electricity-bill)',
    required: false,
  })
  @Prop({
    required: false,
    type: String,
    enum: Object.values(AddressProofType),
  })
  proofType?: AddressProofType;

  @Prop({
    required: false,
    type: Boolean,
    default: true,
  })    
  isReferencedRequired?: boolean;

  @ApiProperty()
  @Prop({
    required: true,
    type: Boolean,
    default: true,
  })
  isActive: boolean;

  @ApiProperty()
  @Prop({
    required: false,
    type: Boolean,
    default: false,
  })
  isDeleted: boolean;

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

export const FileSchema = SchemaFactory.createForClass(File);
FileSchema.plugin(commonFieldsPlugin, {name: File.name});

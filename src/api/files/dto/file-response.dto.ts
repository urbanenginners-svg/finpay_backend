import { ApiProperty } from '@nestjs/swagger';
import { FileResourceEnum } from 'src/utils/enums/file-resource.enum';
import {
  DocumentType,
  IdProofType,
  AddressProofType,
} from 'src/utils/enums/document-type.enum';

export class FileResponseDto {
  @ApiProperty({ example: 'file::123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'https://my-bucket.s3.amazonaws.com/vendor/abc.jpg' })
  imageUrl: string;

  @ApiProperty({ example: 'vendor/2024/abc.jpg' })
  s3Key: string;

  @ApiProperty({ example: 'profile-photo.jpg', required: false })
  originalName?: string;

  @ApiProperty({ example: 'image/jpeg', required: false })
  mimeType?: string;

  @ApiProperty({ example: 204800, required: false })
  size?: number;

  @ApiProperty({ enum: FileResourceEnum, example: FileResourceEnum.VENDOR })
  type: FileResourceEnum;

  @ApiProperty({
    example: 'vendor::123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  referenceId?: string;

  @ApiProperty({ enum: DocumentType, required: false })
  documentType?: DocumentType;

  @ApiProperty({ enum: IdProofType, required: false })
  idType?: IdProofType;

  @ApiProperty({ enum: AddressProofType, required: false })
  proofType?: AddressProofType;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isDeleted: boolean;

  @ApiProperty({ required: false })
  createdBy?: string;

  @ApiProperty({ required: false })
  lastUpdatedBy?: string;

  @ApiProperty({ required: false })
  deletedBy?: string;

  @ApiProperty({ required: false })
  deletedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PresignedUrlResponseDto {
  @ApiProperty({ description: 'Presigned URL to access the file from S3' })
  presignedUrl: string;

  @ApiProperty({ description: 'Expiry time in seconds', example: 3600 })
  expiresIn: number;
}

export class PublicUrlResponseDto {
  @ApiProperty({
    description: 'Temporary presigned URL to access the file (expires in 1 hour)',
    example: 'https://my-bucket.s3.ap-south-1.amazonaws.com/vendor/abc.jpg?X-Amz-Signature=...',
  })
  presignedUrl: string;

  @ApiProperty({ description: 'S3 object key', example: 'vendor/2024/abc.jpg' })
  s3Key: string;

  @ApiProperty({ description: 'Expiry time in seconds', example: 3600 })
  expiresIn: number;
}

export class UploadResponseDto {
  @ApiProperty({ description: 'Publicly accessible S3 URL of the uploaded file' })
  imageUrl: string;

  @ApiProperty({ description: 'S3 object key', example: 'vendor/2024/abc.jpg' })
  s3Key: string;

  @ApiProperty({ description: 'Created file document', type: FileResponseDto })
  file: FileResponseDto;
}

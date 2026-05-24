import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FileResourceEnum } from 'src/utils/enums/file-resource.enum';
import {
  DocumentType,
  IdProofType,
  AddressProofType,
} from 'src/utils/enums/document-type.enum';

export class CreateFileDto {
  @ApiProperty({
    enum: FileResourceEnum,
    example: FileResourceEnum.DOCUMENT,
    description: 'The resource/entity type this file belongs to',
  })
  @IsEnum(FileResourceEnum, { message: 'type must be a valid FileResourceEnum value' })
  @IsNotEmpty({ message: 'type is required' })
  type: FileResourceEnum;

  @ApiProperty({
    example: 'franchise::123e4567-e89b-12d3-a456-426614174000',
    description: 'Optional ID of the entity this file is associated with',
    required: false,
  })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiProperty({
    enum: DocumentType,
    example: DocumentType.ID_PROOF,
    description:
      'Document classification — idProof, societyAgreement, or addressProof',
    required: false,
  })
  @IsEnum(DocumentType)
  @IsOptional()
  documentType?: DocumentType;

  @ApiProperty({
    enum: IdProofType,
    example: IdProofType.AADHAAR,
    description: 'ID proof sub-type — required when documentType is idProof',
    required: false,
  })
  @IsEnum(IdProofType)
  @IsOptional()
  idType?: IdProofType;

  @ApiProperty({
    enum: AddressProofType,
    example: AddressProofType.AADHAAR,
    description: 'Address proof sub-type — required when documentType is addressProof',
    required: false,
  })
  @IsEnum(AddressProofType)
  @IsOptional()
  proofType?: AddressProofType;
}

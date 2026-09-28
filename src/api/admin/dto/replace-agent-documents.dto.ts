import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ReplaceAdditionalAgentDocumentDto {
  @ApiProperty({ example: 'additional_shop_certificate_1710000000' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'File ID from POST /files/upload' })
  @IsString()
  @IsNotEmpty()
  fileId: string;
}

/** Document files are uploaded separately via POST /files/upload. */
export class ReplaceAgentDocumentsDto {
  @ApiPropertyOptional({
    description:
      'Map of standard document key (for the agent type) to the new file ID',
    example: {
      panCard: 'file::123e4567-e89b-12d3-a456-426614174010',
    },
  })
  @IsOptional()
  @IsObject()
  documents?: Record<string, string>;

  @ApiPropertyOptional({
    type: [ReplaceAdditionalAgentDocumentDto],
    description:
      'Replacement files for additional documents the agent already has on record',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceAdditionalAgentDocumentDto)
  additionalDocuments?: ReplaceAdditionalAgentDocumentDto[];
}

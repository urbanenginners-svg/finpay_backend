import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum AgentDocumentRequestTypeEnum {
  UPDATE = 'update',
  ADDITIONAL = 'additional',
}

export class AgentDocumentRevisionItemDto {
  @ApiProperty({ example: 'panCard' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'PAN Card' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ enum: AgentDocumentRequestTypeEnum })
  @IsEnum(AgentDocumentRequestTypeEnum)
  requestType: AgentDocumentRequestTypeEnum;

  @ApiPropertyOptional({ example: 'Document is blurry — please re-upload a clear copy.' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class RequestAgentDocumentUpdateDto {
  @ApiPropertyOptional({
    example: 'Please update the documents listed below so we can complete your verification.',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ type: [AgentDocumentRevisionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AgentDocumentRevisionItemDto)
  items: AgentDocumentRevisionItemDto[];
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { ServiceEnquiryStatus } from 'src/utils/enums/service-enquiry-status.enum';

export class UpdateServiceEnquiryDto {
  @ApiPropertyOptional({ enum: ServiceEnquiryStatus })
  @IsOptional()
  @IsEnum(ServiceEnquiryStatus)
  status?: ServiceEnquiryStatus;

  @ApiPropertyOptional({
    description: 'Conversation note to append to the enquiry record',
    maxLength: 2000,
  })
  @IsOptional()
  @ValidateIf((dto) => dto.note !== undefined && dto.note !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';
import { ServiceEnquiryType } from 'src/utils/enums/service-enquiry-type.enum';
import { ServiceEnquiryStatus } from 'src/utils/enums/service-enquiry-status.enum';

export class GetEnquiriesQueryDto extends CommonFieldsDto {
  @ApiPropertyOptional({ enum: ServiceEnquiryType })
  @IsOptional()
  @IsEnum(ServiceEnquiryType)
  serviceType?: ServiceEnquiryType;

  @ApiPropertyOptional({ enum: ServiceEnquiryStatus })
  @IsOptional()
  @IsEnum(ServiceEnquiryStatus)
  status?: ServiceEnquiryStatus;

  @ApiPropertyOptional({
    description: 'Filter by priority (callback requested)',
    example: 'true',
  })
  @IsOptional()
  @IsString()
  isPriority?: string;
}

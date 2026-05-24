import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { ServiceEnquiryType } from 'src/utils/enums/service-enquiry-type.enum';
import { ContactDto } from './contact.dto';

export class CreateServiceEnquiryDto {
  @ApiProperty({ enum: ServiceEnquiryType })
  @IsEnum(ServiceEnquiryType, {
    message:
      'serviceType must be one of: outward-remittance, foreign-exchange, mutual-fund, travel, insurance, loan',
  })
  serviceType: ServiceEnquiryType;

  @ApiProperty({ type: ContactDto })
  @ValidateNested()
  @Type(() => ContactDto)
  @IsNotEmpty({ message: 'Contact information is required' })
  contact: ContactDto;

  @ApiProperty({
    description: 'Service-specific details; shape depends on serviceType',
    example: { currency: 'USD', amount: 1000 },
  })
  @IsObject({ message: 'serviceDetails must be an object' })
  @IsNotEmpty({ message: 'serviceDetails is required' })
  serviceDetails: Record<string, unknown>;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { ContactDto } from './contact.dto';

export class CreateServiceEnquiryDto {
  @ApiProperty({ example: 'outward-remittance' })
  @IsString({ message: 'serviceType must be a string' })
  @IsNotEmpty({ message: 'serviceType is required' })
  serviceType: string;

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

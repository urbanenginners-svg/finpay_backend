import { ApiProperty } from '@nestjs/swagger';
import { ServiceEnquiryType } from 'src/utils/enums/service-enquiry-type.enum';
import { ServiceEnquiryStatus } from 'src/utils/enums/service-enquiry-status.enum';

export class SubmitEnquiryResponseDto {
  @ApiProperty()
  enquiryId: string;

  @ApiProperty({ enum: ServiceEnquiryType })
  serviceType: ServiceEnquiryType;

  @ApiProperty({ enum: ServiceEnquiryStatus, example: ServiceEnquiryStatus.PENDING })
  status: ServiceEnquiryStatus;

  @ApiProperty()
  submittedAt: string;
}

export class ServiceOptionDto {
  @ApiProperty()
  value: string;

  @ApiProperty()
  label: string;
}

export class ServiceEnquiryResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  referenceNumber?: string;

  @ApiProperty({ enum: ServiceEnquiryType })
  serviceType: ServiceEnquiryType;

  @ApiProperty()
  contact: {
    fullName: string;
    mobile: string;
    email: string;
    callbackRequested: boolean;
  };

  @ApiProperty()
  serviceDetails: Record<string, unknown>;

  @ApiProperty({ enum: ServiceEnquiryStatus })
  status: ServiceEnquiryStatus;

  @ApiProperty()
  source: string;

  @ApiProperty()
  isPriority: boolean;

  @ApiProperty({ required: false })
  estimatedInrValue?: number;

  @ApiProperty({ required: false })
  fxRateUsed?: number;

  @ApiProperty({ required: false, isArray: true })
  adminNotes?: {
    _id: string;
    content: string;
    createdByUserId: string;
    createdByName: string;
    createdAt: Date;
  }[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

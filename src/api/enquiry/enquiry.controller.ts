import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { EnquiryService } from './enquiry.service';
import {
  CreateServiceEnquiryDto,
  GetEnquiriesQueryDto,
} from './dto';
import { DataResponse, PaginatedDataResponse } from 'src/utils/response';
import { Public } from 'src/utils/decorators/public-key.decorator';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';
import {
  GetEnquiryByIdSwagger,
  GetEnquiriesSwagger,
  GetServicesSwagger,
  SubmitEnquirySwagger,
} from './enquiry.swagger';

const SUBMIT_SUCCESS_MESSAGE =
  'Enquiry submitted successfully. Our team will contact you within 2 business hours.';

@ApiTags('Service Enquiry Hub')
@Controller('enquiries')
export class EnquiryController {
  constructor(private readonly enquiryService: EnquiryService) {}

  @Public()
  @Version('1')
  @Post()
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @SubmitEnquirySwagger()
  async submit(@Body() dto: CreateServiceEnquiryDto) {
    const result = await this.enquiryService.create(dto);
    return new DataResponse(
      { success: true, ...result },
      SUBMIT_SUCCESS_MESSAGE,
    );
  }

  @Public()
  @Version('1')
  @Get('services')
  @GetServicesSwagger()
  async getServices() {
    const services = this.enquiryService.getAvailableServices();
    return new DataResponse(services);
  }

  @Version('1')
  @Get()
  @UseGuards(PoliciesGuard)
  @GetEnquiriesSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.Enquiry)
  async findAll(@Query() query: GetEnquiriesQueryDto) {
    const result = await this.enquiryService.findAll(query);
    return new PaginatedDataResponse(result.data, result.meta);
  }

  @Version('1')
  @Get(':enquiryId')
  @UseGuards(PoliciesGuard)
  @GetEnquiryByIdSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.Enquiry)
  async findOne(@Param('enquiryId') enquiryId: string) {
    const result = await this.enquiryService.findOne(enquiryId);
    return new DataResponse(result);
  }
}

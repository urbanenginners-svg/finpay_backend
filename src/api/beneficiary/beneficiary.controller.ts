import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { BeneficiaryService } from './beneficiary.service';
import { CreateBeneficiaryDto } from './dto';
import { DataResponse } from 'src/utils/response';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';
import {
  CreateBeneficiarySwagger,
  ListBeneficiariesSwagger,
} from './beneficiary.swagger';

@ApiTags('Beneficiaries')
@ApiBearerAuth()
@Controller('beneficiaries')
export class BeneficiaryController {
  constructor(private readonly beneficiaryService: BeneficiaryService) {}

  @Version('1')
  @Get()
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ListBeneficiariesSwagger()
  async list(@GetUser('_id') userId: string) {
    const data = await this.beneficiaryService.listForUser(userId);
    return new DataResponse(data, 'Beneficiaries fetched successfully');
  }

  @Version('1')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @CreateBeneficiarySwagger()
  async create(
    @GetUser('_id') userId: string,
    @Body() dto: CreateBeneficiaryDto,
  ) {
    const data = await this.beneficiaryService.create(userId, dto);
    return new DataResponse(data, 'Beneficiary saved successfully');
  }
}

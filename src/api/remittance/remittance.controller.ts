import { Controller, Get, Query, UseGuards, Version } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { RemittanceService } from './remittance.service';
import { GetRemittanceRatesQueryDto } from './dto';
import { DataResponse } from 'src/utils/response';
import { Public } from 'src/utils/decorators/public-key.decorator';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';
import {
  GetRemittanceProvidersSwagger,
  GetRemittanceRatesSwagger,
} from './remittance.swagger';

@ApiTags('Remittance')
@Controller('remittance')
export class RemittanceController {
  constructor(private readonly remittanceService: RemittanceService) {}

  @Public()
  @Version('1')
  @Get('providers')
  @GetRemittanceProvidersSwagger()
  async getProviders() {
    const providers = this.remittanceService.getProviders();
    return new DataResponse(providers);
  }

  @Public()
  @Version('1')
  @Get('rates')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @GetRemittanceRatesSwagger()
  async getRates(@Query() query: GetRemittanceRatesQueryDto) {
    const rate = await this.remittanceService.getRates(query);
    return new DataResponse(rate);
  }
}

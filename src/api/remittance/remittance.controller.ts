import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { RemittanceService } from './remittance.service';
import {
  CompleteForexRequestDto,
  GetForexOrdersDashboardQueryDto,
  GetPurposesQueryDto,
  GetRemittanceRatesQueryDto,
  InitiateForexRequestDto,
} from './dto';
import { DataResponse } from 'src/utils/response';
import { Public } from 'src/utils/decorators/public-key.decorator';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';
import {
  CompleteForexRequestSwagger,
  GetForexOrdersDashboardSwagger,
  GetPurposeConfigSwagger,
  GetPurposesSwagger,
  GetRemittanceProvidersSwagger,
  GetRemittanceRatesSwagger,
  InitiateForexRequestSwagger,
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

  @ApiBearerAuth()
  @Version('1')
  @Post('forex/initiate')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @InitiateForexRequestSwagger()
  async initiateForex(@Body() dto: InitiateForexRequestDto) {
    const data = await this.remittanceService.initiateForex(dto);
    return new DataResponse(data, 'Forex request created successfully.');
  }

  @ApiBearerAuth()
  @Version('1')
  @Post('forex/:id/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @CompleteForexRequestSwagger()
  async completeForex(
    @Param('id') id: string,
    @Body() dto: CompleteForexRequestDto,
  ) {
    const data = await this.remittanceService.completeForex(id, dto);
    return new DataResponse(
      data,
      'Forex request completed and submitted for approval',
    );
  }

  @ApiBearerAuth()
  @Version('1')
  @Get('forex/orders/dashboard')
  @GetForexOrdersDashboardSwagger()
  async getForexOrdersDashboard(
    @Query() query: GetForexOrdersDashboardQueryDto,
  ) {
    const result = await this.remittanceService.getForexOrdersDashboard(query);
    return {
      data: result.data,
      meta: result.meta,
      message: 'Forex orders retrieved successfully.',
    };
  }

  @Public()
  @Version('1')
  @Get('purposes')
  @GetPurposesSwagger()
  async listPurposes(@Query() query: GetPurposesQueryDto) {
    const purposes = await this.remittanceService.listPurposes(query);
    return new DataResponse(purposes);
  }

  @Public()
  @Version('1')
  @Get('purposes/:code/config')
  @GetPurposeConfigSwagger()
  async getPurposeConfig(@Param('code') code: string) {
    const config = await this.remittanceService.getPurposeConfig(code);
    return new DataResponse(config);
  }
}

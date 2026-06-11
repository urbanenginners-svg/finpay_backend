import { Body, Controller, Get, Post, Query, Version } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SystemConfigService } from './system-config.service';
import { BulkUpsertPricingDto, GetPricingConfigQueryDto } from './dto';
import { DataResponse } from 'src/utils/response';
import { Public } from 'src/utils/decorators/public-key.decorator';
import { RequireApiKey } from 'src/utils/decorators/require-api-key.decorator';
import {
  BulkUpsertPricingSwagger,
  GetPricingConfigSwagger,
} from './system-config.swagger';

@ApiTags('System Config')
@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Version('1')
  @Post('pricing')
  @RequireApiKey()
  @BulkUpsertPricingSwagger()
  async bulkUpsertPricing(@Body() dto: BulkUpsertPricingDto) {
    const result = await this.systemConfigService.bulkUpsertPricing(dto);
    return new DataResponse(result, 'Pricing configs saved successfully.');
  }

  @Public()
  @Version('1')
  @Get('pricing')
  @GetPricingConfigSwagger()
  async getPricing(@Query() query: GetPricingConfigQueryDto) {
    const result = await this.systemConfigService.getPricing(query);
    return new DataResponse(result);
  }
}

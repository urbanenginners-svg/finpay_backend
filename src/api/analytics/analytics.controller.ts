import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { Public } from 'src/utils/decorators/public-key.decorator';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';
import { DataResponse } from 'src/utils/response';
import { AnalyticsService } from './analytics.service';
import { CollectEventDto } from './dto';

@ApiTags('Website Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @Version('1')
  @Post('collect')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({
    summary: 'Record a page view from a visitor who has consented to analytics',
    description:
      'Called by the public website only after the visitor accepts analytics. Requests carrying ' +
      'Global Privacy Control (Sec-GPC: 1) or a bot user agent are ignored. The client IP is used ' +
      'transiently for an offline location lookup and is never stored.',
  })
  async collect(@Body() dto: CollectEventDto, @Req() req: Request) {
    const result = await this.analyticsService.collect(dto, {
      headers: req.headers as Record<string, unknown>,
      ip: req.ip,
    });
    return new DataResponse(result);
  }
}

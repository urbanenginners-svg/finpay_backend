import { Controller, Post, Version } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
// import { Throttle } from '@nestjs/throttler';

import { SeedService } from './seed.service';
import { DataResponse } from 'src/utils/response';
import { Public } from 'src/utils/decorators/public-key.decorator';

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Public()
  @Version('1')
  @Post('run')
  // @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary:
      'Run database seeds (permissions, roles, users, system API key). Public route; protect at the network or gateway level in production.',
  })
  @ApiResponse({ status: 200, description: 'Seeds completed successfully' })
  async run() {
    await this.seedService.run();
    return new DataResponse(
      { success: true },
      'Database seeds completed successfully.',
    );
  }
}

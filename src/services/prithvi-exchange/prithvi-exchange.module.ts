import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  PrithviApiLog,
  PrithviApiLogSchema,
} from 'src/services/mongoose/schemas/prithvi-api-log.schema';
import {
  PrithviAgentRatesCache,
  PrithviAgentRatesCacheSchema,
} from 'src/services/mongoose/schemas/prithvi-agent-rates-cache.schema';
import {
  PrithviPurposeCache,
  PrithviPurposeCacheSchema,
} from 'src/services/mongoose/schemas/prithvi-purpose-cache.schema';
import { PrithviAgentRatesCacheService } from './prithvi-agent-rates-cache.service';
import { PrithviPurposeCacheService } from './prithvi-purpose-cache.service';
import { PrithviApiLogService } from './prithvi-api-log.service';
import { PrithviExchangeService } from './prithvi-exchange.service';
import { PrithviExchangeTasks } from './prithvi-exchange.tasks';
import { PrithviForexApiService } from './prithvi-forex-api.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrithviApiLog.name, schema: PrithviApiLogSchema },
      { name: PrithviAgentRatesCache.name, schema: PrithviAgentRatesCacheSchema },
      { name: PrithviPurposeCache.name, schema: PrithviPurposeCacheSchema },
    ]),
  ],
  providers: [
    PrithviExchangeService,
    PrithviForexApiService,
    PrithviExchangeTasks,
    PrithviApiLogService,
    PrithviAgentRatesCacheService,
    PrithviPurposeCacheService,
  ],
  exports: [
    PrithviExchangeService,
    PrithviForexApiService,
    PrithviApiLogService,
    PrithviAgentRatesCacheService,
    PrithviPurposeCacheService,
  ],
})
export class PrithviExchangeModule {}

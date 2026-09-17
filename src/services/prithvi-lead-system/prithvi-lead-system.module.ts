import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  PrithviLeadSystemApiLog,
  PrithviLeadSystemApiLogSchema,
} from 'src/services/mongoose/schemas/prithvi-lead-system-api-log.schema';
import {
  PrithviLrsCache,
  PrithviLrsCacheSchema,
} from 'src/services/mongoose/schemas/prithvi-lrs-cache.schema';
import { PrithviLeadSystemApiLogService } from './prithvi-lead-system-api-log.service';
import { PrithviLeadSystemService } from './prithvi-lead-system.service';
import { PrithviLeadSystemTasks } from './prithvi-lead-system.tasks';
import { PrithviLrsCacheService } from './prithvi-lrs-cache.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: PrithviLeadSystemApiLog.name,
        schema: PrithviLeadSystemApiLogSchema,
      },
      {
        name: PrithviLrsCache.name,
        schema: PrithviLrsCacheSchema,
      },
    ]),
  ],
  providers: [
    PrithviLeadSystemService,
    PrithviLeadSystemTasks,
    PrithviLeadSystemApiLogService,
    PrithviLrsCacheService,
  ],
  exports: [
    PrithviLeadSystemService,
    PrithviLeadSystemApiLogService,
    PrithviLrsCacheService,
  ],
})
export class PrithviLeadSystemModule {}

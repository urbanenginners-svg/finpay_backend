import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  PrithviLeadSystemApiLog,
  PrithviLeadSystemApiLogSchema,
} from 'src/services/mongoose/schemas/prithvi-lead-system-api-log.schema';
import { PrithviLeadSystemApiLogService } from './prithvi-lead-system-api-log.service';
import { PrithviLeadSystemService } from './prithvi-lead-system.service';
import { PrithviLeadSystemTasks } from './prithvi-lead-system.tasks';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: PrithviLeadSystemApiLog.name,
        schema: PrithviLeadSystemApiLogSchema,
      },
    ]),
  ],
  providers: [
    PrithviLeadSystemService,
    PrithviLeadSystemTasks,
    PrithviLeadSystemApiLogService,
  ],
  exports: [PrithviLeadSystemService, PrithviLeadSystemApiLogService],
})
export class PrithviLeadSystemModule {}

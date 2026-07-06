import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  PrithviApiLog,
  PrithviApiLogSchema,
} from 'src/services/mongoose/schemas/prithvi-api-log.schema';
import { PrithviApiLogService } from './prithvi-api-log.service';
import { PrithviExchangeService } from './prithvi-exchange.service';
import { PrithviExchangeTasks } from './prithvi-exchange.tasks';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrithviApiLog.name, schema: PrithviApiLogSchema },
    ]),
  ],
  providers: [PrithviExchangeService, PrithviExchangeTasks, PrithviApiLogService],
  exports: [PrithviExchangeService, PrithviApiLogService],
})
export class PrithviExchangeModule {}

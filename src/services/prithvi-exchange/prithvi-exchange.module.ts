import { Global, Module } from '@nestjs/common';

import { PrithviExchangeService } from './prithvi-exchange.service';
import { PrithviExchangeTasks } from './prithvi-exchange.tasks';

@Global()
@Module({
  providers: [PrithviExchangeService, PrithviExchangeTasks],
  exports: [PrithviExchangeService],
})
export class PrithviExchangeModule {}

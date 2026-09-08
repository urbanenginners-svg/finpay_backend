import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  AgentCardRate,
  AgentCardRateSchema,
} from 'src/services/mongoose/schemas/agent-card-rate.schema';
import { AgentCardRateService } from './agent-card-rate.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentCardRate.name, schema: AgentCardRateSchema },
    ]),
  ],
  providers: [AgentCardRateService],
  exports: [AgentCardRateService],
})
export class AgentCardRateModule {}

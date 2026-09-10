import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AgentCustomerController } from './agent-customer.controller';
import { AgentCustomerService } from './agent-customer.service';
import {
  AgentCustomer,
  AgentCustomerSchema,
} from 'src/services/mongoose/schemas/agent-customer.schema';
import {
  Beneficiary,
  BeneficiarySchema,
} from 'src/services/mongoose/schemas/beneficiary.schema';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentCustomer.name, schema: AgentCustomerSchema },
      { name: Beneficiary.name, schema: BeneficiarySchema },
    ]),
  ],
  controllers: [AgentCustomerController],
  providers: [AgentCustomerService, ThrottlerBehindProxyGuard],
  exports: [AgentCustomerService],
})
export class AgentCustomerModule {}

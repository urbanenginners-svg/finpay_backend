import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BeneficiaryController } from './beneficiary.controller';
import { BeneficiaryService } from './beneficiary.service';
import {
  Beneficiary,
  BeneficiarySchema,
} from 'src/services/mongoose/schemas/beneficiary.schema';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Beneficiary.name, schema: BeneficiarySchema },
    ]),
  ],
  controllers: [BeneficiaryController],
  providers: [BeneficiaryService, ThrottlerBehindProxyGuard],
  exports: [BeneficiaryService],
})
export class BeneficiaryModule {}

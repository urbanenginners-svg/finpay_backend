import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  CustomerCardRate,
  CustomerCardRateSchema,
} from 'src/services/mongoose/schemas/customer-card-rate.schema';
import { CustomerCardRateService } from './customer-card-rate.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerCardRate.name, schema: CustomerCardRateSchema },
    ]),
  ],
  providers: [CustomerCardRateService],
  exports: [CustomerCardRateService],
})
export class CustomerCardRateModule {}

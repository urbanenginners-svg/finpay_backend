import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import {
  CrossCountryPricing,
  CrossCountryPricingSchema,
} from 'src/services/mongoose/schemas/cross-country-pricing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CrossCountryPricing.name, schema: CrossCountryPricingSchema },
    ]),
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}

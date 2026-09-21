import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  CardRateGlobalSettings,
  CardRateGlobalSettingsSchema,
} from 'src/services/mongoose/schemas/card-rate-global-settings.schema';
import {
  CardRateMarkup,
  CardRateMarkupSchema,
} from 'src/services/mongoose/schemas/card-rate-markup.schema';
import { CardRateConfigService } from './card-rate-config.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardRateMarkup.name, schema: CardRateMarkupSchema },
      { name: CardRateGlobalSettings.name, schema: CardRateGlobalSettingsSchema },
    ]),
  ],
  providers: [CardRateConfigService],
  exports: [CardRateConfigService],
})
export class CardRateConfigModule {}

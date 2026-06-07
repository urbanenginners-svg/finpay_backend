import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  RemittanceProviderToken,
  RemittanceProviderTokenSchema,
} from 'src/services/mongoose/schemas/remittance-provider-token.schema';
import { RemittanceProviderTokenService } from './remittance-provider-token.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: RemittanceProviderToken.name,
        schema: RemittanceProviderTokenSchema,
      },
    ]),
  ],
  providers: [RemittanceProviderTokenService],
  exports: [RemittanceProviderTokenService],
})
export class RemittanceProviderTokenModule {}

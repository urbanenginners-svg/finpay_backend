import { Global, Module } from '@nestjs/common';

import { HostingerService } from './hostinger.service';

@Global()
@Module({
  providers: [HostingerService],
  exports: [HostingerService],
})
export class EmailModule {}

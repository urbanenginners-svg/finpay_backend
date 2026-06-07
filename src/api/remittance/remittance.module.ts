import { Module } from '@nestjs/common';

import { RemittanceController } from './remittance.controller';
import { RemittanceAdminController } from './remittance-admin.controller';
import { RemittanceService } from './remittance.service';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';

@Module({
  controllers: [RemittanceController, RemittanceAdminController],
  providers: [RemittanceService, ThrottlerBehindProxyGuard],
  exports: [RemittanceService],
})
export class RemittanceModule {}

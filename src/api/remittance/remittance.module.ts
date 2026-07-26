import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RemittanceController } from './remittance.controller';
import { RemittanceAdminController } from './remittance-admin.controller';
import { RemittanceService } from './remittance.service';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';
import { User, UserSchema } from 'src/services/mongoose/schemas/user.schema';
import { FilesModule } from 'src/api/files/files.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    FilesModule,
  ],
  controllers: [RemittanceController, RemittanceAdminController],
  providers: [RemittanceService, ThrottlerBehindProxyGuard],
  exports: [RemittanceService],
})
export class RemittanceModule {}

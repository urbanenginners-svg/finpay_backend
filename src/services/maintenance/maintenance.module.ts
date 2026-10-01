import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  MaintenanceSettings,
  MaintenanceSettingsSchema,
} from 'src/services/mongoose/schemas/maintenance-settings.schema';
import { MaintenanceService } from './maintenance.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceSettings.name, schema: MaintenanceSettingsSchema },
    ]),
  ],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}

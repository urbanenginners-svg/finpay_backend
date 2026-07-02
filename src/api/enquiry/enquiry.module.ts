import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EnquiryController } from './enquiry.controller';
import { EnquiryService } from './enquiry.service';
import {
  ServiceEnquiry,
  ServiceEnquirySchema,
} from 'src/services/mongoose/schemas/service-enquiry.schema';
import { Permission, PermissionSchema } from 'src/services/mongoose/schemas/permission.schema';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';
import { CaslAbilityFactory } from 'src/services/casl/casl-ability.factory';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    SystemConfigModule,
    MongooseModule.forFeature([
      { name: ServiceEnquiry.name, schema: ServiceEnquirySchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [EnquiryController],
  providers: [
    EnquiryService,
    CaslAbilityFactory,
    PoliciesGuard,
    ThrottlerBehindProxyGuard,
  ],
  exports: [EnquiryService],
})
export class EnquiryModule {}

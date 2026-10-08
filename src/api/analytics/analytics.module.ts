import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsAdminController } from './analytics-admin.controller';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsVisitor,
  AnalyticsVisitorSchema,
} from 'src/services/mongoose/schemas/analytics-visitor.schema';
import {
  AnalyticsSession,
  AnalyticsSessionSchema,
} from 'src/services/mongoose/schemas/analytics-session.schema';
import {
  AnalyticsPageView,
  AnalyticsPageViewSchema,
} from 'src/services/mongoose/schemas/analytics-page-view.schema';
import {
  ServiceEnquiry,
  ServiceEnquirySchema,
} from 'src/services/mongoose/schemas/service-enquiry.schema';
import { Permission, PermissionSchema } from 'src/services/mongoose/schemas/permission.schema';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';
import { CaslAbilityFactory } from 'src/services/casl/casl-ability.factory';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalyticsVisitor.name, schema: AnalyticsVisitorSchema },
      { name: AnalyticsSession.name, schema: AnalyticsSessionSchema },
      { name: AnalyticsPageView.name, schema: AnalyticsPageViewSchema },
      { name: ServiceEnquiry.name, schema: ServiceEnquirySchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [AnalyticsController, AnalyticsAdminController],
  providers: [AnalyticsService, CaslAbilityFactory, PoliciesGuard, ThrottlerBehindProxyGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

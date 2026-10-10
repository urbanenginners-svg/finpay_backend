import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AgentAgreementController } from './agent-agreement.controller';
import { AgentAgreementAdminController } from './agent-agreement-admin.controller';
import { AgentAgreementService } from './agent-agreement.service';
import {
  AgentAgreement,
  AgentAgreementSchema,
} from 'src/services/mongoose/schemas/agent-agreement.schema';
import { User, UserSchema } from 'src/services/mongoose/schemas/user.schema';
import { Permission, PermissionSchema } from 'src/services/mongoose/schemas/permission.schema';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';
import { CaslAbilityFactory } from 'src/services/casl/casl-ability.factory';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentAgreement.name, schema: AgentAgreementSchema },
      { name: User.name, schema: UserSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [AgentAgreementController, AgentAgreementAdminController],
  providers: [AgentAgreementService, CaslAbilityFactory, PoliciesGuard, ThrottlerBehindProxyGuard],
  exports: [AgentAgreementService],
})
export class AgentAgreementModule {}

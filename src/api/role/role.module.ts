import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';
import { CaslAbilityFactory } from 'src/services/casl/casl-ability.factory';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import {
  Permission,
  PermissionSchema,
} from 'src/services/mongoose/schemas/permission.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: Permission.name, schema: PermissionSchema },
    ]),
  ],
  controllers: [RoleController],
  providers: [RoleService, CaslAbilityFactory, PoliciesGuard],
  exports: [RoleService],
})
export class RoleModule {}

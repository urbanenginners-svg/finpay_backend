import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from 'src/services/mongoose/schemas/user.schema';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';
import { Permission, PermissionSchema } from 'src/services/mongoose/schemas/permission.schema';
import { CaslAbilityFactory } from 'src/services/casl/casl-ability.factory';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Permission.name, schema: PermissionSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, CaslAbilityFactory, PoliciesGuard],
  exports: [AdminService],
})
export class AdminModule {}

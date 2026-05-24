import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { File, FileSchema } from 'src/services/mongoose/schemas/file.schema';
import { CaslAbilityFactory } from 'src/services/casl/casl-ability.factory';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { Permission, PermissionSchema } from 'src/services/mongoose/schemas/permission.schema';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: File.name, schema: FileSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [FilesController],
  providers: [FilesService, CaslAbilityFactory, PoliciesGuard],
  exports: [FilesService],
})
export class FilesModule {}

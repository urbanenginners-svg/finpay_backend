import { Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthService } from "./auth.service";
import { RegistrationService } from "./registration.service";
import { AadhaarVerificationService } from "./aadhaar-verification.service";
import { PanVerificationService } from "./pan-verification.service";
import { AuthController } from "./auth.controller";
import { FilesModule } from '../files/files.module';
import { User, UserSchema } from 'src/services/mongoose/schemas/user.schema';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';
import { Permission, PermissionSchema } from 'src/services/mongoose/schemas/permission.schema';
import { CaslAbilityFactory } from 'src/services/casl/casl-ability.factory';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';

@Module({
    imports: [
        FilesModule,
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Role.name, schema: RoleSchema },
            { name: Permission.name, schema: PermissionSchema },
        ]),
        JwtModule.registerAsync({
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '7d' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, RegistrationService, AadhaarVerificationService, PanVerificationService, CaslAbilityFactory, PoliciesGuard],
    exports: [AuthService, RegistrationService, JwtModule],
})
export class AuthModule {}  
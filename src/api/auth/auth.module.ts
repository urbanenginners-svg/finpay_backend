import { Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthService } from "./auth.service";
import { RegistrationService } from "./registration.service";
import { AadhaarVerificationService } from "./aadhaar-verification.service";
import { AuthController } from "./auth.controller";
import { FilesModule } from '../files/files.module';
import { User, UserSchema } from 'src/services/mongoose/schemas/user.schema';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';

@Module({
    imports: [
        FilesModule,
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Role.name, schema: RoleSchema },
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
    providers: [AuthService, RegistrationService, AadhaarVerificationService],
    exports: [AuthService, RegistrationService, JwtModule],
})
export class AuthModule {}  
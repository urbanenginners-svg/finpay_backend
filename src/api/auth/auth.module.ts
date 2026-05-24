import { Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { User, UserSchema } from 'src/services/mongoose/schemas/user.schema';
import { Role, RoleSchema } from 'src/services/mongoose/schemas/role.schema';

@Module({
    imports: [
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
    providers: [AuthService],
    exports: [AuthService, JwtModule],
})
export class AuthModule {}  
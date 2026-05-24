import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AppConfigModule } from "src/services/env/env.module";
import { AuthModule } from "src/api/auth/auth.module";
import { FilesModule } from "src/api/files/files.module";
import { AdminModule } from "src/api/admin/admin.module";
import { RoleModule } from "src/api/role/role.module";
import { SeedModule } from "src/api/seed/seed.module";
import { EnquiryModule } from "src/api/enquiry/enquiry.module";
import { SmsModule } from "src/services/sms";
import { JwtAuthGuard } from "src/services/auth/jwt-auth.guard";
import { ApiKeyAuthGuard } from "src/services/auth/api-key-auth.guard";
import { User, UserSchema } from "src/services/mongoose/schemas/user.schema";
import { SystemApiKey, SystemApiKeySchema } from "src/services/mongoose/schemas/system-api-key.schema";

@Module({
    imports: [
        AppConfigModule,
        ThrottlerModule.forRoot([
            {
                name: 'default',
                ttl: 60_000,
                limit: 100,
            },
        ]),
        AuthModule,
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: SystemApiKey.name, schema: SystemApiKeySchema },
        ]),
        FilesModule,
        AdminModule,
        RoleModule,
        SeedModule,
        EnquiryModule,
        SmsModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        ApiKeyAuthGuard,
        JwtAuthGuard,
        {
            provide: APP_GUARD,
            useClass: ApiKeyAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
    ],
})
export class AppModule { }

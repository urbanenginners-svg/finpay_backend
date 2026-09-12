import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";
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
import { RemittanceModule } from "src/api/remittance/remittance.module";
import { BeneficiaryModule } from "src/api/beneficiary/beneficiary.module";
import { AgentCustomerModule } from "src/api/agent-customer/agent-customer.module";
import { SystemConfigModule } from "src/api/system-config/system-config.module";
import { SmsModule } from "src/services/sms";
import { EmailModule } from "src/services/email";
import { RemittanceProviderTokenModule } from "src/services/remittance-provider-token";
import { HttpFormModule } from "src/services/http";
import { PrithviExchangeModule } from "src/services/prithvi-exchange";
import { PrithviLeadSystemModule } from "src/services/prithvi-lead-system";
import { AgentCardRateModule } from "src/services/agent-card-rate/agent-card-rate.module";
import { CustomerCardRateModule } from "src/services/customer-card-rate/customer-card-rate.module";
import { JwtAuthGuard } from "src/services/auth/jwt-auth.guard";
import { ApiKeyAuthGuard } from "src/services/auth/api-key-auth.guard";
import { User, UserSchema } from "src/services/mongoose/schemas/user.schema";
import { SystemApiKey, SystemApiKeySchema } from "src/services/mongoose/schemas/system-api-key.schema";

@Module({
    imports: [
        AppConfigModule,
        ScheduleModule.forRoot(),
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
        RemittanceModule,
        BeneficiaryModule,
        AgentCustomerModule,
        SystemConfigModule,
        SmsModule,
        EmailModule,
        RemittanceProviderTokenModule,
        HttpFormModule,
        PrithviExchangeModule,
        PrithviLeadSystemModule,
        AgentCardRateModule,
        CustomerCardRateModule,
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

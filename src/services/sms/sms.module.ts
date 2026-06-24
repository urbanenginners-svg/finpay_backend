import { Global, Module } from '@nestjs/common';

import { smsTemplateRegistry } from './mappings/sms-template.registry';
import { SMS_TEMPLATE_REGISTRY } from './sms.constants';
import { SmsService } from './sms.service';
import { TwilioService } from './twilio.service';

@Global()
@Module({
  providers: [
    TwilioService,
    SmsService,
    {
      provide: SMS_TEMPLATE_REGISTRY,
      useValue: smsTemplateRegistry,
    },
  ],
  exports: [SmsService, TwilioService],
})
export class SmsModule {}

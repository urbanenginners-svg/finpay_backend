import { Global, Module } from '@nestjs/common';

import { smsTemplateRegistry } from './mappings/sms-template.registry';
import { SMS_TEMPLATE_REGISTRY } from './sms.constants';
import { SmsService } from './sms.service';

@Global()
@Module({
  providers: [
    SmsService,
    {
      provide: SMS_TEMPLATE_REGISTRY,
      useValue: smsTemplateRegistry,
    },
  ],
  exports: [SmsService],
})
export class SmsModule {}

import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';

import { AppConfigService } from 'src/services/env/env.service';
import { TwilioService } from './twilio.service';
import { SMS_TEMPLATE_REGISTRY } from './sms.constants';
import { SMS_TEMPLATE_KEYS } from './mappings/sms-template.registry';
import type { SmsTemplateDefinition, SmsTemplateRegistry } from './types/sms-template.types';

export type SendTemplatedSmsParams = {
  templateKey: string;
  destinations: string | string[];
  variables: Record<string, string | number>;
};

export type SendOtpSmsParams = {
  phoneNumber: string;
  name: string;
  otp: string;
};

@Injectable()
export class SmsService {
  constructor(
    private readonly config: AppConfigService,
    private readonly twilioService: TwilioService,
    @Inject(SMS_TEMPLATE_REGISTRY)
    private readonly templateRegistry: SmsTemplateRegistry,
  ) {}

  /** True when Twilio is configured to send real SMS. */
  isSmsDeliveryActive(): boolean {
    return this.config.get('TWILIO_ACTIVE_MODE') === 'true';
  }

  async sendOtpSms(params: SendOtpSmsParams): Promise<void> {
    await this.sendTemplatedSms({
      templateKey: SMS_TEMPLATE_KEYS.CUSTOMER_OTP,
      destinations: params.phoneNumber,
      variables: {
        name: params.name,
        otp: params.otp,
      },
    });
  }

  private normalizeDestinations(
    destinations: string | string[],
  ): string[] {
    return (Array.isArray(destinations) ? destinations : [destinations])
      .map((d) => d.trim())
      .filter(Boolean);
  }

  private renderMessage(
    definition: SmsTemplateDefinition,
    variables: Record<string, string | number>,
  ): string {
    let message = definition.bodyTemplate;
    for (const key of definition.variableKeys) {
      const value = variables[key];
      if (value === undefined || value === null || String(value) === '') {
        throw new BadRequestException(`Missing SMS template variable: ${key}`);
      }
      message = message.replace(
        new RegExp(`\\{${key}\\}`, 'g'),
        String(value),
      );
    }
    return message;
  }

  /**
   * Sends a templated SMS via Twilio when `TWILIO_ACTIVE_MODE` is `"true"`.
   * Otherwise logs and returns (dry run).
   */
  async sendTemplatedSms(params: SendTemplatedSmsParams): Promise<void> {
    const destinationList = this.normalizeDestinations(params.destinations);
    if (destinationList.length === 0) {
      throw new BadRequestException('At least one SMS destination is required.');
    }

    const definition = this.templateRegistry[params.templateKey];
    if (!definition) {
      throw new BadRequestException(
        `SMS template not found for key: ${params.templateKey}`,
      );
    }

    const message = this.renderMessage(definition, params.variables);

    for (const destination of destinationList) {
      await this.twilioService.sendSms({ to: destination, body: message });
    }
  }
}

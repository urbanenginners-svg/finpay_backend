import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import twilio = require('twilio');

import { AppConfigService } from 'src/services/env/env.service';

export type SendTwilioSmsParams = {
  to: string;
  body: string;
};

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: ReturnType<typeof twilio> | null = null;

  constructor(private readonly config: AppConfigService) {}

  /**
   * Sends an SMS via Twilio when `TWILIO_ACTIVE_MODE` is exactly `"true"`.
   * Otherwise logs the payload and returns without calling the API.
   */
  async sendSms(params: SendTwilioSmsParams): Promise<void> {
    const activeMode = this.config.get('TWILIO_ACTIVE_MODE');
    const to = this.normalizePhoneE164(params.to);

    if (activeMode !== 'true') {
      this.logger.warn(
        `TWILIO_ACTIVE_MODE is not "true"; skipping SMS send. to=${to}`,
      );
      this.logger.debug(`SMS dry-run body: ${params.body}`);
      return;
    }

    const accountSid = this.config.get('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get('TWILIO_AUTH_TOKEN');
    const from = this.config.get('TWILIO_PHONE_NUMBER');

    if (!accountSid?.trim() || !authToken?.trim() || !from?.trim()) {
      this.logger.error(
        'Twilio SMS is active but TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER is missing.',
      );
      throw new InternalServerErrorException(
        'SMS provider is not configured correctly.',
      );
    }

    try {
      const client = this.getClient(accountSid, authToken);
      const message = await client.messages.create({
        body: params.body,
        from,
        to,
      });

      this.logger.log(`Twilio SMS sent to ${to} (sid=${message.sid})`);
    } catch (error) {
      console.log(error, ">>>>>>>> error");
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send SMS via Twilio: ${detail}`);
      throw new InternalServerErrorException(
        'Unable to send SMS right now. Please try again later.',
      );
    }
  }

  private getClient(accountSid: string, authToken: string): ReturnType<typeof twilio> {
    if (!this.client) {
      this.client = twilio(accountSid, authToken);
    }
    return this.client;
  }

  /** Normalises Indian 10-digit numbers and other inputs to E.164 for Twilio. */
  normalizePhoneE164(phone: string): string {
    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) {
      return trimmed;
    }

    const digits = trimmed.replace(/\D/g, '');

    if (digits.length === 10) {
      return `+91${digits}`;
    }

    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }

    return `+${digits}`;
  }
}

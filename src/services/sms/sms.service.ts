import axios, { isAxiosError } from 'axios';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { AppConfigService } from 'src/services/env/env.service';
import { SMS_TEMPLATE_REGISTRY } from './sms.constants';
import type { SmsTemplateDefinition, SmsTemplateRegistry } from './types/sms-template.types';

export type SendTemplatedSmsParams = {
  templateKey: string;
  destinations: string | string[];
  variables: Record<string, string | number>;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly config: AppConfigService,
    @Inject(SMS_TEMPLATE_REGISTRY)
    private readonly templateRegistry: SmsTemplateRegistry,
  ) {}

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
   * Sends a DLT-registered SMS via Airtel when `AIRTEL_ACTIVE_MODE` is exactly `"true"`.
   * Otherwise logs the payload and returns without calling the API.
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

    const customerId = this.config.get('AIRTEL_CUSTOMER_ID') as
      | string
      | undefined;
    const entityId = this.config.get('AIRTEL_ENTITY_ID') as string | undefined;
    const apiToken = this.config.get('AIRTEL_API_TOKEN') as string | undefined;
    const airtelUrl = this.config.get('AIRTEL_URL') as string | undefined;
    const activeMode = this.config.get('AIRTEL_ACTIVE_MODE') as
      | string
      | undefined;

    const payload = {
      customerId,
      destinationAddress: destinationList,
      dltTemplateId: definition.dltTemplateId,
      entityId,
      message,
      messageType: definition.messageType,
      sourceAddress: definition.sourceAddress,
    };

    if (activeMode !== 'true') {
      this.logger.warn(
        `AIRTEL_ACTIVE_MODE is not "true"; skipping SMS send. templateKey=${params.templateKey} destinations=${destinationList.join(',')}`,
      );
      this.logger.debug(`SMS dry-run payload: ${JSON.stringify(payload)}`);
      return;
    }

    if (!airtelUrl || !customerId || !entityId || !apiToken) {
      this.logger.error(
        'Airtel SMS is active but AIRTEL_URL, AIRTEL_CUSTOMER_ID, AIRTEL_ENTITY_ID, or AIRTEL_API_TOKEN is missing.',
      );
      throw new InternalServerErrorException(
        'SMS provider is not configured correctly.',
      );
    }

    try {
      const response = await axios.post(airtelUrl, payload, {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Basic ${apiToken}`,
        },
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        this.logger.error(
          `Airtel SMS HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(
          'Unable to send SMS right now. Please try again later.',
        );
      }

      this.logger.log(
        `SMS template "${params.templateKey}" accepted by Airtel for ${destinationList.length} destination(s).`,
      );
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      const detail = isAxiosError(error)
        ? JSON.stringify(error.response?.data ?? error.message)
        : error instanceof Error
          ? error.message
          : String(error);
      this.logger.error(`Failed to send SMS via Airtel: ${detail}`);
      throw new InternalServerErrorException(
        'Unable to send SMS right now. Please try again later.',
      );
    }
  }
}

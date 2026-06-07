import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrithviExchangeService } from './prithvi-exchange.service';

@Injectable()
export class PrithviExchangeTasks {
  private readonly logger = new Logger(PrithviExchangeTasks.name);

  constructor(private readonly prithviService: PrithviExchangeService) {}

  /** Refresh OAuth token before the 24h access token expires. */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.prithviService.isActive) {
      return;
    }

    try {
      await this.prithviService.ensureTokenFreshness();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Prithvi token refresh cron failed: ${detail}`);
    }
  }
}

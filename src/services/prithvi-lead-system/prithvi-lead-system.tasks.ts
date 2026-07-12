import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrithviLeadSystemService } from './prithvi-lead-system.service';

@Injectable()
export class PrithviLeadSystemTasks {
  private readonly logger = new Logger(PrithviLeadSystemTasks.name);

  constructor(private readonly leadSystemService: PrithviLeadSystemService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.leadSystemService.isActive) {
      return;
    }

    try {
      await this.leadSystemService.ensureTokenFreshness();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Prithvi Lead System token refresh cron failed: ${detail}`,
      );
    }
  }
}

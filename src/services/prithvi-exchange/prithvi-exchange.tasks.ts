import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  PRITHVI_AGENT_RATES_CRON,
  PRITHVI_AGENT_RATES_CRON_TIMEZONE,
  PRITHVI_PURPOSE_LIST_CRON,
  PRITHVI_PURPOSE_LIST_CRON_TIMEZONE,
} from './prithvi-exchange.constants';
import { PrithviExchangeService } from './prithvi-exchange.service';
import { PrithviForexApiService } from './prithvi-forex-api.service';
import { PrithviAgentRatesCacheService } from './prithvi-agent-rates-cache.service';
import { PrithviPurposeCacheService } from './prithvi-purpose-cache.service';

@Injectable()
export class PrithviExchangeTasks implements OnModuleInit {
  private readonly logger = new Logger(PrithviExchangeTasks.name);

  constructor(
    private readonly prithviService: PrithviExchangeService,
    private readonly prithviForex: PrithviForexApiService,
    private readonly ratesCache: PrithviAgentRatesCacheService,
    private readonly purposeCache: PrithviPurposeCacheService,
  ) {}

  /** Seed caches on startup when empty so data is available before the first cron run. */
  async onModuleInit(): Promise<void> {
    await Promise.all([this.seedRatesCache(), this.seedPurposeCache()]);
  }

  private async seedRatesCache(): Promise<void> {
    try {
      const agentId = this.prithviService.getConfiguredAgentId();
      if (!agentId) return;

      const hasCache = await this.ratesCache.hasCache(agentId);
      if (!hasCache) {
        this.logger.log(
          'No cached Prithvi agent rates found; running initial sync.',
        );
        await this.prithviService.syncAgentRatesFromProvider(agentId);
      }
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Prithvi initial rates sync failed: ${detail}`);
    }
  }

  private async seedPurposeCache(): Promise<void> {
    try {
      const hasCache = await this.purposeCache.hasCache();
      if (!hasCache) {
        this.logger.log(
          'No cached Prithvi purposes found; running initial sync.',
        );
        await this.prithviForex.syncPurposesFromProvider();
      }
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Prithvi initial purpose sync failed: ${detail}`);
    }
  }

  /** Sync agent FX rates from Prithvi at 9:00 AM and 6:00 PM IST. */
  @Cron(PRITHVI_AGENT_RATES_CRON, { timeZone: PRITHVI_AGENT_RATES_CRON_TIMEZONE })
  async syncAgentRates(): Promise<void> {
    try {
      await this.prithviService.syncAgentRatesFromProvider();
      this.logger.log('Prithvi agent rates cron sync completed.');
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Prithvi agent rates cron sync failed: ${detail}`);
    }
  }

  /** Sync LRS purpose catalogue from Prithvi on the 1st of each month at 2:00 AM IST. */
  @Cron(PRITHVI_PURPOSE_LIST_CRON, {
    timeZone: PRITHVI_PURPOSE_LIST_CRON_TIMEZONE,
  })
  async syncPurposes(): Promise<void> {
    try {
      await this.prithviForex.syncPurposesFromProvider();
      this.logger.log('Prithvi purpose list cron sync completed.');
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Prithvi purpose list cron sync failed: ${detail}`);
    }
  }

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

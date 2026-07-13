import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PrithviAgentRatesCache,
  PrithviAgentRatesCacheDocument,
} from 'src/services/mongoose/schemas/prithvi-agent-rates-cache.schema';
import type { PrithviAgentRatesResult } from './prithvi-exchange.types';

export type SaveAgentRatesCacheInput = {
  agentId: string;
  rates: PrithviAgentRatesResult;
  isDryRun: boolean;
  fetchedAt?: Date;
};

@Injectable()
export class PrithviAgentRatesCacheService {
  constructor(
    @InjectModel(PrithviAgentRatesCache.name)
    private readonly model: Model<PrithviAgentRatesCacheDocument>,
  ) {}

  async upsert(input: SaveAgentRatesCacheInput): Promise<PrithviAgentRatesCacheDocument> {
    const fetchedAt = input.fetchedAt ?? new Date();
    return this.model
      .findOneAndUpdate(
        { agentId: input.agentId },
        {
          agentId: input.agentId,
          message: input.rates.message ?? null,
          source: input.rates.source ?? null,
          providerTimestamp: input.rates.timestamp,
          fetchedAt,
          currencies: input.rates.currencies,
          isDryRun: input.isDryRun,
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  findByAgentId(agentId: string) {
    return this.model.findOne({ agentId }).lean().exec();
  }

  async hasCache(agentId: string): Promise<boolean> {
    const count = await this.model.countDocuments({ agentId }).exec();
    return count > 0;
  }
}

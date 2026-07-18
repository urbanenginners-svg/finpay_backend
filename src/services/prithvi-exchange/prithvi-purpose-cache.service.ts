import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PrithviPurposeCache,
  PrithviPurposeCacheDocument,
} from 'src/services/mongoose/schemas/prithvi-purpose-cache.schema';
import type { PrithviPurpose } from './prithvi-exchange.types';

export const PRITHVI_PURPOSE_CACHE_KEY = 'default';

export type SavePurposeCacheInput = {
  purposes: PrithviPurpose[];
  isDryRun: boolean;
  fetchedAt?: Date;
};

@Injectable()
export class PrithviPurposeCacheService {
  constructor(
    @InjectModel(PrithviPurposeCache.name)
    private readonly model: Model<PrithviPurposeCacheDocument>,
  ) {}

  async upsert(input: SavePurposeCacheInput): Promise<PrithviPurposeCacheDocument> {
    const fetchedAt = input.fetchedAt ?? new Date();
    return this.model
      .findOneAndUpdate(
        { cacheKey: PRITHVI_PURPOSE_CACHE_KEY },
        {
          cacheKey: PRITHVI_PURPOSE_CACHE_KEY,
          fetchedAt,
          purposes: input.purposes,
          isDryRun: input.isDryRun,
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  findLatest() {
    return this.model
      .findOne({ cacheKey: PRITHVI_PURPOSE_CACHE_KEY })
      .lean()
      .exec();
  }

  async hasCache(): Promise<boolean> {
    const count = await this.model
      .countDocuments({ cacheKey: PRITHVI_PURPOSE_CACHE_KEY })
      .exec();
    return count > 0;
  }
}

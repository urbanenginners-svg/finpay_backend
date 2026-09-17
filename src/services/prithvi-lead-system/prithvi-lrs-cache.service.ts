import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PrithviLrsCache,
  PrithviLrsCacheDocument,
} from 'src/services/mongoose/schemas/prithvi-lrs-cache.schema';
import type { PrithviLeadSystemLrsCheckData } from './prithvi-lead-system.types';

/** Reuse a successful LRS check for the same PAN for 24 hours. */
export const PRITHVI_LRS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type SaveLrsCacheInput = {
  pan: string;
  result: PrithviLeadSystemLrsCheckData;
  isDryRun: boolean;
  fetchedAt?: Date;
  ttlMs?: number;
};

@Injectable()
export class PrithviLrsCacheService {
  constructor(
    @InjectModel(PrithviLrsCache.name)
    private readonly model: Model<PrithviLrsCacheDocument>,
  ) {}

  async findValidByPan(pan: string): Promise<PrithviLrsCacheDocument | null> {
    const normalized = pan.trim().toUpperCase();
    if (!normalized) return null;
    return this.model
      .findOne({
        pan: normalized,
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  toLrsCheckData(doc: PrithviLrsCacheDocument): PrithviLeadSystemLrsCheckData {
    const remittance =
      doc.totalRemittance != null
        ? doc.totalRemittance
        : doc.totalRemittanceInINRRaw;
    return {
      success: doc.success,
      fromCache: true,
      pan: doc.pan,
      reportDate: doc.reportDate,
      currency: doc.currency,
      limit: doc.limit,
      totalRemittance:
        typeof remittance === 'string' || typeof remittance === 'number'
          ? remittance
          : null,
      totalRemittanceInINR: doc.totalRemittanceInINR,
      totalRemittanceInINRRaw: doc.totalRemittanceInINRRaw,
      category: doc.category,
      detailsAvailable: doc.detailsAvailable,
    };
  }

  async upsert(input: SaveLrsCacheInput): Promise<PrithviLrsCacheDocument> {
    const pan = input.pan.trim().toUpperCase();
    const fetchedAt = input.fetchedAt ?? new Date();
    const ttlMs = input.ttlMs ?? PRITHVI_LRS_CACHE_TTL_MS;
    const expiresAt = new Date(fetchedAt.getTime() + ttlMs);
    const { result } = input;

    const totalRemittanceRaw =
      result.totalRemittance == null
        ? null
        : String(result.totalRemittance);
    const totalRemittanceInINRRaw =
      result.totalRemittanceInINRRaw == null
        ? null
        : String(result.totalRemittanceInINRRaw);

    return this.model
      .findOneAndUpdate(
        { pan },
        {
          pan,
          fetchedAt,
          expiresAt,
          success: result.success,
          reportDate: result.reportDate,
          currency: result.currency,
          limit: result.limit,
          totalRemittance: totalRemittanceRaw,
          totalRemittanceInINR: result.totalRemittanceInINR,
          totalRemittanceInINRRaw,
          category: result.category,
          detailsAvailable: result.detailsAvailable,
          isDryRun: input.isDryRun,
        },
        { upsert: true, new: true },
      )
      .exec();
  }
}

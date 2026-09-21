import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  CustomerCardRate,
  CustomerCardRateDocument,
} from 'src/services/mongoose/schemas/customer-card-rate.schema';
import {
  resolveFinpayCommission,
  roundMoney,
  toFiniteNumber,
  type AgentCardRateSnapshot,
} from 'src/utils/agent-commission.util';

export type UpsertCustomerCardRateInput = {
  currency: string;
  /** LRS purpose code. Required on save. */
  purposeCode?: string;
  vendorRate?: number;
  finpayCommission?: number;
  finpaySellRate?: number;
  cardRate?: number;
  updatedByAdminId?: string | null;
};

export type CustomerCardRateRow = {
  id: string;
  currency: string;
  purposeCode: string;
  vendorRate: number;
  finpayCommission: number;
  finpaySellRate: number;
  cardRate: number;
  updatedByAdminId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CacheEntry = {
  expiresAt: number;
  value: AgentCardRateSnapshot | null;
};

const CARD_RATE_CACHE_TTL_MS = 30_000;
const CARD_RATE_CACHE_MAX = 500;

@Injectable()
export class CustomerCardRateService implements OnModuleInit {
  private readonly logger = new Logger(CustomerCardRateService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectModel(CustomerCardRate.name)
    private readonly model: Model<CustomerCardRateDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.model.updateMany(
        {
          $or: [
            { purposeCode: { $exists: false } },
            { purposeCode: null },
          ],
        },
        { $set: { purposeCode: '' } },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to backfill customer card rate purposeCode: ${String(err)}`,
      );
    }

    for (const name of ['currency_1']) {
      try {
        await this.model.collection.dropIndex(name);
        this.logger.log(`Dropped legacy index ${name}`);
      } catch {
        // Index may not exist.
      }
    }

    try {
      await this.model.syncIndexes();
    } catch (err) {
      this.logger.warn(
        `Failed to sync customer card rate indexes: ${String(err)}`,
      );
    }
  }

  private normalizeCurrency(currency: string): string {
    return String(currency ?? '')
      .trim()
      .toUpperCase();
  }

  private normalizePurposeCode(purposeCode?: string | null): string {
    return String(purposeCode ?? '').trim();
  }

  private cacheKey(currency: string, purposeCode: string): string {
    return `${currency}::${purposeCode}`;
  }

  private invalidate(currency?: string, purposeCode?: string): void {
    if (currency && purposeCode !== undefined) {
      this.cache.delete(
        this.cacheKey(
          this.normalizeCurrency(currency),
          this.normalizePurposeCode(purposeCode),
        ),
      );
      return;
    }
    if (currency) {
      const prefix = `${this.normalizeCurrency(currency)}::`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) this.cache.delete(key);
      }
      return;
    }
    this.cache.clear();
  }

  private putCache(
    currency: string,
    purposeCode: string,
    value: AgentCardRateSnapshot | null,
  ): void {
    if (this.cache.size >= CARD_RATE_CACHE_MAX) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(this.cacheKey(currency, purposeCode), {
      expiresAt: Date.now() + CARD_RATE_CACHE_TTL_MS,
      value,
    });
  }

  private toRow(
    doc: CustomerCardRateDocument | CustomerCardRate,
  ): CustomerCardRateRow {
    const id =
      typeof (doc as CustomerCardRateDocument)._id?.toString === 'function'
        ? (doc as CustomerCardRateDocument)._id.toString()
        : String((doc as { id?: string }).id ?? '');
    const vendorRate = toFiniteNumber(doc.vendorRate, 0);
    const finpaySellRate = toFiniteNumber(doc.finpaySellRate, 0);
    const finpayCommission = resolveFinpayCommission({
      finpayCommission: (doc as CustomerCardRate).finpayCommission,
      finpaySellRate,
      vendorRate,
    });
    return {
      id,
      currency: doc.currency,
      purposeCode: this.normalizePurposeCode(
        (doc as CustomerCardRate).purposeCode,
      ),
      vendorRate,
      finpayCommission,
      finpaySellRate,
      cardRate: toFiniteNumber(doc.cardRate, 0),
      updatedByAdminId: doc.updatedByAdminId ?? null,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : doc.createdAt
            ? String(doc.createdAt)
            : undefined,
      updatedAt:
        doc.updatedAt instanceof Date
          ? doc.updatedAt.toISOString()
          : doc.updatedAt
            ? String(doc.updatedAt)
            : undefined,
    };
  }

  private snapshotFromRow(
    row: {
      vendorRate?: number;
      finpayCommission?: number;
      finpaySellRate?: number;
      cardRate?: number;
    } | null,
  ): AgentCardRateSnapshot | null {
    if (!row) return null;
    const vendorRate = toFiniteNumber(row.vendorRate, 0);
    const finpaySellRate = toFiniteNumber(row.finpaySellRate, 0);
    const snapshot: AgentCardRateSnapshot = {
      vendorRate,
      finpaySellRate,
      cardRate: toFiniteNumber(row.cardRate, 0),
    };
    if (row.finpayCommission != null || finpaySellRate > 0) {
      snapshot.finpayCommission = resolveFinpayCommission({
        finpayCommission: row.finpayCommission,
        finpaySellRate,
        vendorRate,
      });
    }
    return snapshot;
  }

  async getSnapshot(
    currency: string,
    purposeCode?: string | null,
  ): Promise<AgentCardRateSnapshot | null> {
    const code = this.normalizeCurrency(currency);
    const purpose = this.normalizePurposeCode(purposeCode);
    if (!code) return null;

    const key = this.cacheKey(code, purpose);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    let row = await this.model
      .findOne({ currency: code, purposeCode: purpose })
      .select('vendorRate finpayCommission finpaySellRate cardRate purposeCode')
      .lean()
      .exec();

    if (!row && purpose) {
      row = await this.model
        .findOne({ currency: code, purposeCode: '' })
        .select(
          'vendorRate finpayCommission finpaySellRate cardRate purposeCode',
        )
        .lean()
        .exec();
    }

    const value = this.snapshotFromRow(row);
    this.putCache(code, purpose, value);
    return value;
  }

  /** Defaults to zeros when no row exists. */
  async getOrDefault(
    currency: string,
    purposeCode?: string | null,
  ): Promise<AgentCardRateSnapshot> {
    const existing = await this.getSnapshot(currency, purposeCode);
    return (
      existing ?? {
        vendorRate: 0,
        finpaySellRate: 0,
        cardRate: 0,
        finpayCommission: 0,
      }
    );
  }

  async listAll(): Promise<CustomerCardRateRow[]> {
    const rows = await this.model
      .find()
      .sort({ currency: 1, purposeCode: 1 })
      .lean()
      .exec();
    return rows.map((row) => this.toRow(row as CustomerCardRateDocument));
  }

  async upsertRate(
    input: UpsertCustomerCardRateInput,
  ): Promise<CustomerCardRateRow> {
    const currency = this.normalizeCurrency(input.currency);
    const purposeCode = this.normalizePurposeCode(input.purposeCode);
    if (!currency || currency.length !== 3) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }
    if (!purposeCode) {
      throw new BadRequestException(
        'purposeCode is required to set commission for a purpose',
      );
    }

    const vendorRate = roundMoney(
      Math.max(0, toFiniteNumber(input.vendorRate, 0)),
    );
    const finpayCommission = resolveFinpayCommission({
      finpayCommission: input.finpayCommission,
      finpaySellRate: input.finpaySellRate,
      vendorRate,
    });
    const finpaySellRate = roundMoney(
      vendorRate > 0 ? vendorRate + finpayCommission : finpayCommission,
    );
    const cardRate = roundMoney(Math.max(0, toFiniteNumber(input.cardRate, 0)));

    if (cardRate > 0 && finpaySellRate > cardRate) {
      throw new BadRequestException(
        'Customer rate (live TT + commission) cannot exceed card rate.',
      );
    }

    const doc = await this.model
      .findOneAndUpdate(
        { currency, purposeCode },
        {
          $set: {
            vendorRate,
            finpayCommission,
            finpaySellRate,
            cardRate,
            updatedByAdminId: input.updatedByAdminId ?? null,
          },
          $setOnInsert: { currency, purposeCode },
        },
        { upsert: true, new: true },
      )
      .exec();

    this.invalidate(currency, purposeCode);
    return this.toRow(doc);
  }

  async deleteRate(
    currency: string,
    purposeCode?: string | null,
  ): Promise<void> {
    const code = this.normalizeCurrency(currency);
    const purpose = this.normalizePurposeCode(purposeCode);
    if (!purpose) {
      throw new BadRequestException(
        'purposeCode is required to delete a purpose commission',
      );
    }
    const result = await this.model
      .deleteOne({ currency: code, purposeCode: purpose })
      .exec();
    this.invalidate(code, purpose);
    if (!result.deletedCount) {
      throw new NotFoundException(
        'Customer card rate not found for this currency and purpose',
      );
    }
  }
}

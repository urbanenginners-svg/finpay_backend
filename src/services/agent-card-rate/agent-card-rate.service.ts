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
  AgentCardRate,
  AgentCardRateDocument,
} from 'src/services/mongoose/schemas/agent-card-rate.schema';
import {
  resolveFinpayCommission,
  roundMoney,
  toFiniteNumber,
  type AgentCardRateSnapshot,
} from 'src/utils/agent-commission.util';

export type UpsertAgentCardRateInput = {
  agentId: string;
  currency: string;
  /** LRS purpose code. Empty = default/legacy. */
  purposeCode?: string;
  vendorRate?: number;
  /** Admin-configured Finpay markup over live TT (preferred). */
  finpayCommission?: number;
  /** Snapshot of Y + commission at save; recomputed on read. */
  finpaySellRate?: number;
  cardRate?: number;
  updatedByAdminId?: string | null;
};

export type AgentCardRateRow = {
  id: string;
  agentId: string;
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

/** Short TTL cache — card rates change rarely vs order volume. */
const CARD_RATE_CACHE_TTL_MS = 30_000;
const CARD_RATE_CACHE_MAX = 5_000;

@Injectable()
export class AgentCardRateService implements OnModuleInit {
  private readonly logger = new Logger(AgentCardRateService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectModel(AgentCardRate.name)
    private readonly model: Model<AgentCardRateDocument>,
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
        `Failed to backfill agent card rate purposeCode: ${String(err)}`,
      );
    }

    for (const name of ['agentId_1_currency_1']) {
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
        `Failed to sync agent card rate indexes: ${String(err)}`,
      );
    }
  }

  private cacheKey(
    agentId: string,
    currency: string,
    purposeCode: string,
  ): string {
    return `${agentId}::${currency}::${purposeCode}`;
  }

  private normalizeCurrency(currency: string): string {
    return String(currency ?? '')
      .trim()
      .toUpperCase();
  }

  private normalizePurposeCode(purposeCode?: string | null): string {
    return String(purposeCode ?? '').trim();
  }

  private invalidate(
    agentId: string,
    currency?: string,
    purposeCode?: string,
  ): void {
    if (currency && purposeCode !== undefined) {
      this.cache.delete(
        this.cacheKey(
          agentId,
          this.normalizeCurrency(currency),
          this.normalizePurposeCode(purposeCode),
        ),
      );
      return;
    }
    if (currency) {
      const prefix = `${agentId}::${this.normalizeCurrency(currency)}::`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) this.cache.delete(key);
      }
      return;
    }
    const prefix = `${agentId}::`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  private putCache(
    agentId: string,
    currency: string,
    purposeCode: string,
    value: AgentCardRateSnapshot | null,
  ): void {
    if (this.cache.size >= CARD_RATE_CACHE_MAX) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(this.cacheKey(agentId, currency, purposeCode), {
      expiresAt: Date.now() + CARD_RATE_CACHE_TTL_MS,
      value,
    });
  }

  private toRow(doc: AgentCardRateDocument | AgentCardRate): AgentCardRateRow {
    const id =
      typeof (doc as AgentCardRateDocument)._id?.toString === 'function'
        ? (doc as AgentCardRateDocument)._id.toString()
        : String((doc as { id?: string }).id ?? '');
    const vendorRate = toFiniteNumber(doc.vendorRate, 0);
    const finpaySellRate = toFiniteNumber(doc.finpaySellRate, 0);
    const finpayCommission = resolveFinpayCommission({
      finpayCommission: (doc as AgentCardRate).finpayCommission,
      finpaySellRate,
      vendorRate,
    });
    return {
      id,
      agentId: doc.agentId,
      currency: doc.currency,
      purposeCode: this.normalizePurposeCode(
        (doc as AgentCardRate).purposeCode,
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

  /**
   * Hot-path lookup for initiate/complete. Uses short TTL memory cache +
   * compound unique index on (agentId, currency, purposeCode).
   * Falls back to legacy/default purposeCode '' when purpose-specific row missing.
   */
  async getSnapshot(
    agentId: string,
    currency: string,
    purposeCode?: string | null,
  ): Promise<AgentCardRateSnapshot | null> {
    const code = this.normalizeCurrency(currency);
    const purpose = this.normalizePurposeCode(purposeCode);
    if (!agentId || !code) return null;

    const key = this.cacheKey(agentId, code, purpose);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    let row = await this.model
      .findOne({ agentId, currency: code, purposeCode: purpose })
      .select('vendorRate finpayCommission finpaySellRate cardRate purposeCode')
      .lean()
      .exec();

    // Fall back to default/legacy commission when purpose-specific row missing.
    if (!row && purpose) {
      row = await this.model
        .findOne({ agentId, currency: code, purposeCode: '' })
        .select(
          'vendorRate finpayCommission finpaySellRate cardRate purposeCode',
        )
        .lean()
        .exec();
    }

    const value = this.snapshotFromRow(row);
    this.putCache(agentId, code, purpose, value);
    return value;
  }

  /** Defaults to zeros when no row exists (admin UI / agent suggestions). */
  async getOrDefault(
    agentId: string,
    currency: string,
    purposeCode?: string | null,
  ): Promise<AgentCardRateSnapshot> {
    const existing = await this.getSnapshot(agentId, currency, purposeCode);
    return (
      existing ?? {
        vendorRate: 0,
        finpaySellRate: 0,
        cardRate: 0,
      }
    );
  }

  async listByAgent(agentId: string): Promise<AgentCardRateRow[]> {
    const rows = await this.model
      .find({ agentId })
      .sort({ currency: 1, purposeCode: 1 })
      .lean()
      .exec();
    return rows.map((row) => this.toRow(row as AgentCardRateDocument));
  }

  async upsertRate(input: UpsertAgentCardRateInput): Promise<AgentCardRateRow> {
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

    const vendorRate = roundMoney(Math.max(0, toFiniteNumber(input.vendorRate, 0)));
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
        'Agent rate (live TT + commission) cannot exceed card rate.',
      );
    }

    const doc = await this.model
      .findOneAndUpdate(
        { agentId: input.agentId, currency, purposeCode },
        {
          $set: {
            vendorRate,
            finpayCommission,
            finpaySellRate,
            cardRate,
            updatedByAdminId: input.updatedByAdminId ?? null,
          },
          $setOnInsert: {
            agentId: input.agentId,
            currency,
            purposeCode,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    this.invalidate(input.agentId, currency, purposeCode);
    return this.toRow(doc);
  }

  async bulkUpsert(
    agentId: string,
    rates: Array<{
      currency: string;
      purposeCode?: string;
      vendorRate?: number;
      finpayCommission?: number;
      finpaySellRate?: number;
      cardRate?: number;
    }>,
    updatedByAdminId?: string | null,
  ): Promise<AgentCardRateRow[]> {
    const results: AgentCardRateRow[] = [];
    for (const rate of rates) {
      results.push(
        await this.upsertRate({
          agentId,
          currency: rate.currency,
          purposeCode: rate.purposeCode,
          vendorRate: rate.vendorRate,
          finpayCommission: rate.finpayCommission,
          finpaySellRate: rate.finpaySellRate,
          cardRate: rate.cardRate,
          updatedByAdminId,
        }),
      );
    }
    return results;
  }

  async deleteRate(
    agentId: string,
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
      .deleteOne({ agentId, currency: code, purposeCode: purpose })
      .exec();
    this.invalidate(agentId, code, purpose);
    if (!result.deletedCount) {
      throw new NotFoundException(
        'Card rate not found for this currency and purpose',
      );
    }
  }
}

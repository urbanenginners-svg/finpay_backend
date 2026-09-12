import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
  vendorRate?: number;
  finpayCommission?: number;
  finpaySellRate?: number;
  cardRate?: number;
  updatedByAdminId?: string | null;
};

export type CustomerCardRateRow = {
  id: string;
  currency: string;
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
export class CustomerCardRateService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectModel(CustomerCardRate.name)
    private readonly model: Model<CustomerCardRateDocument>,
  ) {}

  private normalizeCurrency(currency: string): string {
    return String(currency ?? '')
      .trim()
      .toUpperCase();
  }

  private invalidate(currency?: string): void {
    if (currency) {
      this.cache.delete(this.normalizeCurrency(currency));
      return;
    }
    this.cache.clear();
  }

  private putCache(currency: string, value: AgentCardRateSnapshot | null): void {
    if (this.cache.size >= CARD_RATE_CACHE_MAX) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(currency, {
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

  async getSnapshot(currency: string): Promise<AgentCardRateSnapshot | null> {
    const code = this.normalizeCurrency(currency);
    if (!code) return null;

    const cached = this.cache.get(code);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const row = await this.model
      .findOne({ currency: code })
      .select('vendorRate finpayCommission finpaySellRate cardRate')
      .lean()
      .exec();

    const value: AgentCardRateSnapshot | null = row
      ? (() => {
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
        })()
      : null;

    this.putCache(code, value);
    return value;
  }

  /** Defaults to zeros when no row exists. */
  async getOrDefault(currency: string): Promise<AgentCardRateSnapshot> {
    const existing = await this.getSnapshot(currency);
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
    const rows = await this.model.find().sort({ currency: 1 }).lean().exec();
    return rows.map((row) => this.toRow(row as CustomerCardRateDocument));
  }

  async upsertRate(
    input: UpsertCustomerCardRateInput,
  ): Promise<CustomerCardRateRow> {
    const currency = this.normalizeCurrency(input.currency);
    if (!currency || currency.length !== 3) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
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
        { currency },
        {
          $set: {
            vendorRate,
            finpayCommission,
            finpaySellRate,
            cardRate,
            updatedByAdminId: input.updatedByAdminId ?? null,
          },
          $setOnInsert: { currency },
        },
        { upsert: true, new: true },
      )
      .exec();

    this.invalidate(currency);
    return this.toRow(doc);
  }

  async deleteRate(currency: string): Promise<void> {
    const code = this.normalizeCurrency(currency);
    const result = await this.model.deleteOne({ currency: code }).exec();
    this.invalidate(code);
    if (!result.deletedCount) {
      throw new NotFoundException('Customer card rate not found for this currency');
    }
  }
}

import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  CARD_RATE_SETTINGS_KEY,
  CardRateGlobalSettings,
  CardRateGlobalSettingsDocument,
} from 'src/services/mongoose/schemas/card-rate-global-settings.schema';
import {
  CardRateMarkup,
  CardRateMarkupDocument,
} from 'src/services/mongoose/schemas/card-rate-markup.schema';
import {
  CARD_RATE_TT_MARKUP_PERCENT,
  DEFAULT_TT_PAISE_OFFSET,
  roundMoney,
  toFiniteNumber,
  type CardRateCalcOptions,
} from 'src/utils/agent-commission.util';

export type CardRateMarkupRow = {
  id: string;
  currency: string;
  markupPercent: number;
  updatedByAdminId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CardRateConfigSnapshot = {
  ttPaiseOffset: number;
  markups: CardRateMarkupRow[];
};

type ConfigCache = {
  expiresAt: number;
  ttPaiseOffset: number;
  markupByCurrency: Map<string, number>;
};

const CONFIG_CACHE_TTL_MS = 30_000;

@Injectable()
export class CardRateConfigService {
  private cache: ConfigCache | null = null;

  constructor(
    @InjectModel(CardRateMarkup.name)
    private readonly markupModel: Model<CardRateMarkupDocument>,
    @InjectModel(CardRateGlobalSettings.name)
    private readonly settingsModel: Model<CardRateGlobalSettingsDocument>,
  ) {}

  private normalizeCurrency(currency: string): string {
    return String(currency ?? '')
      .trim()
      .toUpperCase();
  }

  private invalidate(): void {
    this.cache = null;
  }

  private toMarkupRow(
    doc: CardRateMarkupDocument | CardRateMarkup,
  ): CardRateMarkupRow {
    const id =
      typeof (doc as CardRateMarkupDocument)._id?.toString === 'function'
        ? (doc as CardRateMarkupDocument)._id.toString()
        : String((doc as { id?: string }).id ?? '');
    return {
      id,
      currency: doc.currency,
      markupPercent: toFiniteNumber(doc.markupPercent, CARD_RATE_TT_MARKUP_PERCENT),
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

  private async loadCache(): Promise<ConfigCache> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache;
    }

    const [settings, markupRows] = await Promise.all([
      this.settingsModel.findOne({ key: CARD_RATE_SETTINGS_KEY }).lean().exec(),
      this.markupModel.find().lean().exec(),
    ]);

    const markupByCurrency = new Map<string, number>();
    for (const row of markupRows) {
      const code = this.normalizeCurrency(row.currency);
      if (!code) continue;
      markupByCurrency.set(
        code,
        toFiniteNumber(row.markupPercent, CARD_RATE_TT_MARKUP_PERCENT),
      );
    }

    this.cache = {
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
      ttPaiseOffset: toFiniteNumber(
        settings?.ttPaiseOffset,
        DEFAULT_TT_PAISE_OFFSET,
      ),
      markupByCurrency,
    };
    return this.cache;
  }

  async getTtPaiseOffset(): Promise<number> {
    const cache = await this.loadCache();
    return cache.ttPaiseOffset;
  }

  async getMarkupPercent(currency: string): Promise<number> {
    const code = this.normalizeCurrency(currency);
    const cache = await this.loadCache();
    return (
      cache.markupByCurrency.get(code) ?? CARD_RATE_TT_MARKUP_PERCENT
    );
  }

  async getCalcOptions(currency: string): Promise<CardRateCalcOptions> {
    const [ttPaiseOffset, markupPercent] = await Promise.all([
      this.getTtPaiseOffset(),
      this.getMarkupPercent(currency),
    ]);
    return { ttPaiseOffset, markupPercent };
  }

  async getCalcOptionsMap(): Promise<{
    ttPaiseOffset: number;
    markupByCurrency: Map<string, number>;
  }> {
    const cache = await this.loadCache();
    return {
      ttPaiseOffset: cache.ttPaiseOffset,
      markupByCurrency: new Map(cache.markupByCurrency),
    };
  }

  calcOptionsFor(
    currency: string,
    map: { ttPaiseOffset: number; markupByCurrency: Map<string, number> },
  ): CardRateCalcOptions {
    const code = this.normalizeCurrency(currency);
    return {
      ttPaiseOffset: map.ttPaiseOffset,
      markupPercent:
        map.markupByCurrency.get(code) ?? CARD_RATE_TT_MARKUP_PERCENT,
    };
  }

  async getConfig(): Promise<CardRateConfigSnapshot> {
    const [settings, rows] = await Promise.all([
      this.settingsModel.findOne({ key: CARD_RATE_SETTINGS_KEY }).lean().exec(),
      this.markupModel.find().sort({ currency: 1 }).lean().exec(),
    ]);
    return {
      ttPaiseOffset: toFiniteNumber(
        settings?.ttPaiseOffset,
        DEFAULT_TT_PAISE_OFFSET,
      ),
      markups: rows.map((row) => this.toMarkupRow(row as CardRateMarkupDocument)),
    };
  }

  async upsertTtPaiseOffset(params: {
    ttPaiseOffset: number;
    updatedByAdminId?: string | null;
  }): Promise<{ ttPaiseOffset: number }> {
    const offset = roundMoney(Math.max(0, toFiniteNumber(params.ttPaiseOffset, 0)));
    await this.settingsModel
      .findOneAndUpdate(
        { key: CARD_RATE_SETTINGS_KEY },
        {
          $set: {
            ttPaiseOffset: offset,
            updatedByAdminId: params.updatedByAdminId ?? null,
          },
          $setOnInsert: { key: CARD_RATE_SETTINGS_KEY },
        },
        { upsert: true, new: true },
      )
      .exec();
    this.invalidate();
    return { ttPaiseOffset: offset };
  }

  async upsertMarkup(params: {
    currency: string;
    markupPercent: number;
    updatedByAdminId?: string | null;
  }): Promise<CardRateMarkupRow> {
    const currency = this.normalizeCurrency(params.currency);
    if (!currency || currency.length !== 3) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }
    const markupPercent = roundMoney(
      Math.max(0, toFiniteNumber(params.markupPercent, CARD_RATE_TT_MARKUP_PERCENT)),
    );

    const doc = await this.markupModel
      .findOneAndUpdate(
        { currency },
        {
          $set: {
            markupPercent,
            updatedByAdminId: params.updatedByAdminId ?? null,
          },
          $setOnInsert: { currency },
        },
        { upsert: true, new: true },
      )
      .exec();

    this.invalidate();
    return this.toMarkupRow(doc);
  }

  async bulkUpsertMarkups(params: {
    rates: Array<{ currency: string; markupPercent: number }>;
    updatedByAdminId?: string | null;
  }): Promise<CardRateMarkupRow[]> {
    const results: CardRateMarkupRow[] = [];
    for (const rate of params.rates) {
      results.push(
        await this.upsertMarkup({
          currency: rate.currency,
          markupPercent: rate.markupPercent,
          updatedByAdminId: params.updatedByAdminId,
        }),
      );
    }
    return results;
  }
}

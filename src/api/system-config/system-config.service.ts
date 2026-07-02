import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  CrossCountryPricing,
  CrossCountryPricingDocument,
} from 'src/services/mongoose/schemas/cross-country-pricing.schema';
import {
  BulkUpsertPricingDto,
  GetPricingConfigQueryDto,
  PricingConfigItemDto,
} from './dto';
import { getFxRate, PricingPair } from 'src/utils/helpers/fx-rates.helper';

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectModel(CrossCountryPricing.name)
    private readonly pricingModel: Model<CrossCountryPricingDocument>,
  ) {}

  async bulkUpsertPricing(dto: BulkUpsertPricingDto) {
    const normalizedItems = dto.items.map((item) => this.normalizeItem(item));
    this.assertNoDuplicatePairs(normalizedItems);

    const bulkOps = normalizedItems.map((item) => ({
      updateOne: {
        filter: {
          countryAName: item.countryAName,
          countryBName: item.countryBName,
        },
        update: { $set: item },
        upsert: true,
      },
    }));

    const bulkResult = await this.pricingModel.bulkWrite(bulkOps);

    const records = await this.pricingModel
      .find({
        $or: normalizedItems.map((item) => ({
          countryAName: item.countryAName,
          countryBName: item.countryBName,
        })),
      })
      .exec();

    return {
      created: bulkResult.upsertedCount,
      updated: bulkResult.modifiedCount,
      total: normalizedItems.length,
      items: records.map((record) =>
        this.formatPricingResponse(record, { includeIsActive: true }),
      ),
    };
  }

  async getActivePricingPairs(): Promise<PricingPair[]> {
    const records = await this.pricingModel
      .find({ isActive: true })
      .select('countryBCurrency countryAPricing countryBPricing')
      .lean()
      .exec();

    return records.map((record) => ({
      countryBCurrency: record.countryBCurrency,
      countryAPricing: record.countryAPricing,
      countryBPricing: record.countryBPricing,
    }));
  }

  async getFxRate(from: string, to: string): Promise<number | null> {
    const pricing = await this.getActivePricingPairs();
    return getFxRate(from, to, pricing);
  }

  async getPricing(query: GetPricingConfigQueryDto) {
    const countryAName = query.countryAName?.trim();
    const countryBName = query.countryBName?.trim();

    const activeFilter = { isActive: true };

    if (countryAName && countryBName) {
      const record = await this.pricingModel
        .findOne({ countryAName, countryBName, ...activeFilter })
        .exec();

      if (!record) {
        throw new NotFoundException(
          `Pricing config not found for ${countryAName} ↔ ${countryBName}`,
        );
      }

      return this.formatPricingResponse(record);
    }

    const records = await this.pricingModel
      .find(activeFilter)
      .sort({ countryAName: 1 })
      .exec();
    return records.map((record) => this.formatPricingResponse(record));
  }

  private normalizeItem(item: PricingConfigItemDto) {
    return {
      countryAName: item.countryAName.trim(),
      countryBName: item.countryBName.trim(),
      countryACurrency: item.countryACurrency.trim().toUpperCase(),
      countryBCurrency: item.countryBCurrency.trim().toUpperCase(),
      countryAPricing: item.countryAPricing,
      countryBPricing: item.countryBPricing,
      isActive: item.isActive ?? true,
    };
  }

  private assertNoDuplicatePairs(
    items: ReturnType<SystemConfigService['normalizeItem']>[],
  ): void {
    const seen = new Set<string>();

    for (const item of items) {
      const key = `${item.countryAName.toLowerCase()}::${item.countryBName.toLowerCase()}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate country pair in request: ${item.countryAName} ↔ ${item.countryBName}`,
        );
      }
      seen.add(key);
    }
  }

  private formatPricingResponse(
    record: CrossCountryPricingDocument,
    options?: { includeIsActive?: boolean },
  ) {
    const response = {
      id: record._id,
      referenceNumber: record.referenceNumber,
      countryAName: record.countryAName,
      countryBName: record.countryBName,
      countryACurrency: record.countryACurrency,
      countryBCurrency: record.countryBCurrency,
      countryAPricing: record.countryAPricing,
      countryBPricing: record.countryBPricing,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    if (options?.includeIsActive) {
      return { ...response, isActive: record.isActive };
    }

    return response;
  }
}

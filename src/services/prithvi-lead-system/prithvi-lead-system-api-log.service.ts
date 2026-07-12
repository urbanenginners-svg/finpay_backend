import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import {
  PrithviLeadSystemApiLog,
  PrithviLeadSystemApiLogDocument,
} from 'src/services/mongoose/schemas/prithvi-lead-system-api-log.schema';
import { PrithviLeadSystemApiCallType } from './prithvi-lead-system.types';

export type CreatePrithviLeadSystemApiLogInput = Omit<
  PrithviLeadSystemApiLog,
  'createdAt' | 'updatedAt'
>;

export type FindPrithviLeadSystemApiLogsOptions = {
  callType?: PrithviLeadSystemApiCallType;
  success?: boolean;
  isDryRun?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  skip?: number;
};

@Injectable()
export class PrithviLeadSystemApiLogService {
  constructor(
    @InjectModel(PrithviLeadSystemApiLog.name)
    private readonly model: Model<PrithviLeadSystemApiLogDocument>,
  ) {}

  create(
    data: CreatePrithviLeadSystemApiLogInput,
  ): Promise<PrithviLeadSystemApiLogDocument> {
    return this.model.create(data);
  }

  async findAll(options: FindPrithviLeadSystemApiLogsOptions = {}) {
    const filter: FilterQuery<PrithviLeadSystemApiLog> = {};

    if (options.callType !== undefined) filter.callType = options.callType;
    if (options.success !== undefined) filter.success = options.success;
    if (options.isDryRun !== undefined) filter.isDryRun = options.isDryRun;

    if (options.fromDate || options.toDate) {
      filter.createdAt = {};
      if (options.fromDate) filter.createdAt.$gte = options.fromDate;
      if (options.toDate) filter.createdAt.$lte = options.toDate;
    }

    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(options.skip ?? 0)
        .limit(options.limit ?? 50)
        .lean()
        .exec(),
      this.model.countDocuments(filter),
    ]);

    return { data, total };
  }
}

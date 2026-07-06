import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import {
  PrithviApiLog,
  PrithviApiLogDocument,
} from 'src/services/mongoose/schemas/prithvi-api-log.schema';
import { PrithviApiCallType } from './prithvi-exchange.types';

export type CreatePrithviApiLogInput = Omit<PrithviApiLog, 'createdAt' | 'updatedAt'>;

export type FindPrithviApiLogsOptions = {
  callType?: PrithviApiCallType;
  success?: boolean;
  isDryRun?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  skip?: number;
};

@Injectable()
export class PrithviApiLogService {
  constructor(
    @InjectModel(PrithviApiLog.name)
    private readonly model: Model<PrithviApiLogDocument>,
  ) {}

  /** Persist a single API call log entry. Fire-and-forget safe — callers can void the promise. */
  create(data: CreatePrithviApiLogInput): Promise<PrithviApiLogDocument> {
    return this.model.create(data);
  }

  /** Return paginated logs, newest first. */
  async findAll(options: FindPrithviApiLogsOptions = {}) {
    const filter: FilterQuery<PrithviApiLog> = {};

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

  /** Find a single log entry by its MongoDB _id. */
  findById(id: string) {
    return this.model.findById(id).lean().exec();
  }

  /**
   * Aggregate success/failure counts per callType.
   * Useful for a health / reconciliation dashboard.
   */
  async summary() {
    return this.model
      .aggregate<{
        callType: PrithviApiCallType;
        total: number;
        succeeded: number;
        failed: number;
        avgDurationMs: number;
      }>([
        {
          $group: {
            _id: '$callType',
            total: { $sum: 1 },
            succeeded: { $sum: { $cond: ['$success', 1, 0] } },
            failed: { $sum: { $cond: ['$success', 0, 1] } },
            avgDurationMs: { $avg: '$durationMs' },
          },
        },
        {
          $project: {
            _id: 0,
            callType: '$_id',
            total: 1,
            succeeded: 1,
            failed: 1,
            avgDurationMs: { $round: ['$avgDurationMs', 0] },
          },
        },
        { $sort: { callType: 1 } },
      ])
      .exec();
  }
}

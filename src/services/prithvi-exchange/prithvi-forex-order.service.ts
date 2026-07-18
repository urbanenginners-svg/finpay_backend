import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import {
  PrithviForexOrder,
  PrithviForexOrderDocument,
} from 'src/services/mongoose/schemas/prithvi-forex-order.schema';
import type {
  PrithviForexDashboardOrder,
  PrithviForexOrdersDashboardResult,
} from './prithvi-exchange.types';

export type UpsertForexOrderFromInitiateInput = {
  createdByUserId: string;
  forexRequestId: string;
  prithviOrderId: string;
  orderType?: string | null;
  currency?: string | null;
  product?: string | null;
  currencyAmount?: string | number | null;
  amountInINR?: string | number | null;
  sellingRate?: string | number | null;
  agentSellingRate?: string | number | null;
  gst?: string | number | null;
  serviceCharge?: string | number | null;
  totalAmount?: string | number | null;
  orderCode?: string | null;
  paymentStatus?: string | null;
  status?: string;
  statusLabel?: string | null;
  sessionId?: string | null;
  sessionExpiresAt?: string | Date | null;
  providerCreatedAt?: string | Date | null;
  isDryRun?: boolean;
};

export type UpsertForexOrderFromCompleteInput = {
  prithviOrderId: string;
  forexRequestId?: string;
  status?: string;
  statusLabel?: string | null;
  paymentStatus?: string | null;
  orderCode?: string | null;
  currencyAmount?: string | number | null;
  amountInINR?: string | number | null;
  sellingRate?: string | number | null;
  agentSellingRate?: string | number | null;
  gst?: string | number | null;
  serviceCharge?: string | number | null;
  totalAmount?: string | number | null;
  paidAmount?: string | number | null;
  pendingAmount?: string | number | null;
  travelerName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  panNumber?: string | null;
  purpose?: string | null;
  travelingCountries?: string[];
  deliveryAddress?: string | null;
  pincode?: string | null;
  sourceOfFunds?: string | null;
  preferredDeliveryMode?: string | null;
  preferredPaymentMode?: string | null;
  providerUpdatedAt?: string | Date | null;
};

export type SyncForexOrderFromDashboardInput = {
  prithviOrderId: string;
  forexRequestId?: string | null;
  orderCode?: string | null;
  orderType?: string | null;
  currency?: string | null;
  product?: string | null;
  status: string;
  statusLabel?: string | null;
  paymentStatus?: string | null;
  currencyAmount?: string | number | null;
  amountInINR?: string | number | null;
  totalAmount?: string | number | null;
  travelerName?: string | null;
  providerCreatedAt?: string | Date | null;
  providerUpdatedAt?: string | Date | null;
};

export type ListForexOrdersParams = {
  createdByUserId: string;
  pageNumber?: number;
  pageSize?: number;
  status?: string;
  product?: string;
  fromDate?: string;
  toDate?: string;
};

function asString(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class PrithviForexOrderService {
  constructor(
    @InjectModel(PrithviForexOrder.name)
    private readonly model: Model<PrithviForexOrderDocument>,
  ) {}

  async upsertFromInitiate(
    input: UpsertForexOrderFromInitiateInput,
  ): Promise<PrithviForexOrderDocument> {
    const now = new Date();
    return this.model
      .findOneAndUpdate(
        { prithviOrderId: input.prithviOrderId },
        {
          $set: {
            forexRequestId: input.forexRequestId,
            createdByUserId: String(input.createdByUserId),
            orderType: input.orderType ?? null,
            currency: input.currency ?? null,
            product: input.product ?? null,
            currencyAmount: asString(input.currencyAmount),
            amountInINR: asString(input.amountInINR),
            sellingRate: asString(input.sellingRate),
            agentSellingRate: asString(input.agentSellingRate),
            gst: asString(input.gst),
            serviceCharge: asString(input.serviceCharge),
            totalAmount: asString(input.totalAmount ?? input.amountInINR),
            orderCode: input.orderCode ?? null,
            paymentStatus: input.paymentStatus ?? 'NOT_PAID',
            status: input.status ?? 'DRAFT',
            statusLabel: input.statusLabel ?? 'Draft',
            sessionId: input.sessionId ?? null,
            sessionExpiresAt: asDate(input.sessionExpiresAt),
            providerCreatedAt: asDate(input.providerCreatedAt) ?? now,
            initiatedAt: now,
            isDryRun: input.isDryRun ?? false,
          },
          $setOnInsert: {
            travelingCountries: [],
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  async upsertFromComplete(
    input: UpsertForexOrderFromCompleteInput,
  ): Promise<PrithviForexOrderDocument | null> {
    const $set: Record<string, unknown> = {
      completedAt: new Date(),
      status: input.status ?? 'PENDING',
      statusLabel: input.statusLabel ?? 'Pending Approval',
    };

    if (input.forexRequestId) $set.forexRequestId = input.forexRequestId;
    if (input.paymentStatus != null) $set.paymentStatus = input.paymentStatus;
    if (input.orderCode != null) $set.orderCode = input.orderCode;
    if (input.currencyAmount != null)
      $set.currencyAmount = asString(input.currencyAmount);
    if (input.amountInINR != null) $set.amountInINR = asString(input.amountInINR);
    if (input.sellingRate != null) $set.sellingRate = asString(input.sellingRate);
    if (input.agentSellingRate != null)
      $set.agentSellingRate = asString(input.agentSellingRate);
    if (input.gst != null) $set.gst = asString(input.gst);
    if (input.serviceCharge != null)
      $set.serviceCharge = asString(input.serviceCharge);
    if (input.totalAmount != null) $set.totalAmount = asString(input.totalAmount);
    if (input.paidAmount != null) $set.paidAmount = asString(input.paidAmount);
    if (input.pendingAmount != null)
      $set.pendingAmount = asString(input.pendingAmount);
    if (input.travelerName != null) $set.travelerName = input.travelerName;
    if (input.phoneNumber != null) $set.phoneNumber = input.phoneNumber;
    if (input.email != null) $set.email = input.email;
    if (input.panNumber != null) $set.panNumber = input.panNumber;
    if (input.purpose != null) $set.purpose = input.purpose;
    if (input.travelingCountries != null)
      $set.travelingCountries = input.travelingCountries;
    if (input.deliveryAddress != null)
      $set.deliveryAddress = input.deliveryAddress;
    if (input.pincode != null) $set.pincode = input.pincode;
    if (input.sourceOfFunds != null) $set.sourceOfFunds = input.sourceOfFunds;
    if (input.preferredDeliveryMode != null)
      $set.preferredDeliveryMode = input.preferredDeliveryMode;
    if (input.preferredPaymentMode != null)
      $set.preferredPaymentMode = input.preferredPaymentMode;
    if (input.providerUpdatedAt != null)
      $set.providerUpdatedAt = asDate(input.providerUpdatedAt);

    return this.model
      .findOneAndUpdate(
        { prithviOrderId: input.prithviOrderId },
        { $set },
        { new: true },
      )
      .exec();
  }

  /**
   * Hourly sync: update an existing local order from Prithvi dashboard row.
   * Does not create orphans (orders must have been booked via Finpay).
   */
  async syncFromDashboard(
    input: SyncForexOrderFromDashboardInput,
  ): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { prithviOrderId: input.prithviOrderId },
        {
          $set: {
            ...(input.forexRequestId
              ? { forexRequestId: input.forexRequestId }
              : {}),
            orderCode: input.orderCode ?? null,
            orderType: input.orderType ?? null,
            currency: input.currency ?? null,
            product: input.product ?? null,
            status: input.status,
            statusLabel: input.statusLabel ?? null,
            paymentStatus: input.paymentStatus ?? null,
            currencyAmount: asString(input.currencyAmount),
            amountInINR: asString(input.amountInINR),
            totalAmount: asString(input.totalAmount),
            travelerName: input.travelerName ?? null,
            providerCreatedAt: asDate(input.providerCreatedAt),
            providerUpdatedAt: asDate(input.providerUpdatedAt) ?? new Date(),
            lastSyncedAt: new Date(),
          },
        },
      )
      .exec();

    return result.matchedCount > 0;
  }

  async findDashboardForUser(
    params: ListForexOrdersParams,
  ): Promise<PrithviForexOrdersDashboardResult> {
    const page = Math.max(1, params.pageNumber ?? 1);
    const limit = Math.max(1, Math.min(100, params.pageSize ?? 10));
    const filter = this.buildUserFilter(params);

    const [total, rows] = await Promise.all([
      this.model.countDocuments(filter).exec(),
      this.model
        .find(filter)
        .sort({ providerCreatedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const data: PrithviForexDashboardOrder[] = rows.map((row) => ({
      id: row.prithviOrderId,
      orderCode: row.orderCode ?? undefined,
      orderType: row.orderType ?? undefined,
      currency: row.currency ?? undefined,
      product: row.product ?? undefined,
      status: row.status,
      statusLabel: row.statusLabel ?? undefined,
      paymentStatus: row.paymentStatus ?? undefined,
      currencyAmount: row.currencyAmount ?? undefined,
      amountInINR: row.amountInINR ?? undefined,
      totalAmount: row.totalAmount ?? undefined,
      travelerName: row.travelerName ?? undefined,
      createdAt:
        row.providerCreatedAt?.toISOString?.() ??
        (row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : undefined),
    }));

    return { data, meta: { total, page, limit } };
  }

  private buildUserFilter(
    params: ListForexOrdersParams,
  ): FilterQuery<PrithviForexOrderDocument> {
    const filter: FilterQuery<PrithviForexOrderDocument> = {
      createdByUserId: String(params.createdByUserId),
    };

    if (params.status) {
      filter.status = params.status;
    }
    if (params.product) {
      filter.product = params.product;
    }
    if (params.fromDate || params.toDate) {
      const range: { $gte?: Date; $lte?: Date } = {};
      if (params.fromDate) {
        range.$gte = new Date(`${params.fromDate}T00:00:00.000Z`);
      }
      if (params.toDate) {
        range.$lte = new Date(`${params.toDate}T23:59:59.999Z`);
      }
      filter.providerCreatedAt = range;
    }

    return filter;
  }
}

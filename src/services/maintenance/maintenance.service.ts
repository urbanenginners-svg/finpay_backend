import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  LandingMaintenanceModeEnum,
  MAINTENANCE_SETTINGS_KEY,
  MaintenanceSettings,
  MaintenanceSettingsDocument,
} from 'src/services/mongoose/schemas/maintenance-settings.schema';

export type MaintenanceStatus = {
  landingMode: LandingMaintenanceModeEnum;
  customerPortal: boolean;
  agentPortal: boolean;
  message: string;
  updatedAt: Date | null;
};

export type UpdateMaintenanceInput = Partial<
  Pick<MaintenanceStatus, 'landingMode' | 'customerPortal' | 'agentPortal' | 'message'>
> & { updatedByAdminId: string };

/** Checked on every authenticated request, so keep the DB hit rare. */
const STATUS_CACHE_TTL_MS = 15_000;

const DEFAULT_STATUS: MaintenanceStatus = {
  landingMode: LandingMaintenanceModeEnum.OFF,
  customerPortal: false,
  agentPortal: false,
  message: '',
  updatedAt: null,
};

@Injectable()
export class MaintenanceService {
  private cache: { expiresAt: number; status: MaintenanceStatus } | null = null;

  constructor(
    @InjectModel(MaintenanceSettings.name)
    private readonly settingsModel: Model<MaintenanceSettingsDocument>,
  ) {}

  async getStatus(): Promise<MaintenanceStatus> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.status;
    }

    const doc = await this.settingsModel
      .findOne({ key: MAINTENANCE_SETTINGS_KEY })
      .lean()
      .exec();

    const status = doc ? this.toStatus(doc) : DEFAULT_STATUS;
    this.cache = { expiresAt: Date.now() + STATUS_CACHE_TTL_MS, status };
    return status;
  }

  async update(input: UpdateMaintenanceInput): Promise<MaintenanceStatus> {
    const { updatedByAdminId, ...fields } = input;
    const $set: Record<string, unknown> = { updatedByAdminId };

    for (const [field, value] of Object.entries(fields)) {
      if (value !== undefined) {
        $set[field] = field === 'message' ? String(value).trim() : value;
      }
    }

    const doc = await this.settingsModel
      .findOneAndUpdate(
        { key: MAINTENANCE_SETTINGS_KEY },
        { $set, $setOnInsert: { key: MAINTENANCE_SETTINGS_KEY } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();

    const status = this.toStatus(doc);
    this.cache = { expiresAt: Date.now() + STATUS_CACHE_TTL_MS, status };
    return status;
  }

  private toStatus(doc: MaintenanceSettings): MaintenanceStatus {
    return {
      landingMode: doc.landingMode ?? LandingMaintenanceModeEnum.OFF,
      customerPortal: Boolean(doc.customerPortal),
      agentPortal: Boolean(doc.agentPortal),
      message: doc.message ?? '',
      updatedAt: doc.updatedAt ?? null,
    };
  }
}

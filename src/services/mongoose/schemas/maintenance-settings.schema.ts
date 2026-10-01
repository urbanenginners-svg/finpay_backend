import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type MaintenanceSettingsDocument = HydratedDocument<MaintenanceSettings>;

export const MAINTENANCE_SETTINGS_KEY = 'default';

export enum LandingMaintenanceModeEnum {
  /** Landing page works normally. */
  OFF = 'off',
  /** Landing page stays usable with a maintenance notice banner on top. */
  BANNER = 'banner',
  /** Landing page and enquiry page are replaced by a full maintenance screen. */
  FULL = 'full',
}

/**
 * Site maintenance switches (singleton), controlled from the admin portal.
 * Admin routes are never affected.
 */
@Schema({ collection: 'maintenance_settings', timestamps: true })
export class MaintenanceSettings {
  @ApiProperty({ example: 'default', description: 'Singleton document key.' })
  @Prop({ required: true, type: String, unique: true, default: MAINTENANCE_SETTINGS_KEY })
  key: string;

  @ApiProperty({ enum: LandingMaintenanceModeEnum, default: LandingMaintenanceModeEnum.OFF })
  @Prop({
    required: true,
    type: String,
    enum: Object.values(LandingMaintenanceModeEnum),
    default: LandingMaintenanceModeEnum.OFF,
  })
  landingMode: LandingMaintenanceModeEnum;

  @ApiProperty({ default: false })
  @Prop({ required: true, type: Boolean, default: false })
  customerPortal: boolean;

  @ApiProperty({ default: false })
  @Prop({ required: true, type: Boolean, default: false })
  agentPortal: boolean;

  @ApiPropertyOptional({ description: 'Optional message shown to visitors and users.' })
  @Prop({ required: false, type: String, default: '' })
  message?: string;

  @ApiPropertyOptional({ description: 'Admin user id who last updated this row.' })
  @Prop({ required: false, type: String, default: null })
  updatedByAdminId?: string | null;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export const MaintenanceSettingsSchema = SchemaFactory.createForClass(MaintenanceSettings);

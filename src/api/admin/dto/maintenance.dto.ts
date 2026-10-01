import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { LandingMaintenanceModeEnum } from 'src/services/mongoose/schemas/maintenance-settings.schema';

export class UpdateMaintenanceDto {
  @ApiPropertyOptional({
    enum: LandingMaintenanceModeEnum,
    description:
      'off = normal, banner = site usable with a maintenance notice, full = landing and enquiry pages replaced by a maintenance screen.',
  })
  @IsOptional()
  @IsEnum(LandingMaintenanceModeEnum)
  landingMode?: LandingMaintenanceModeEnum;

  @ApiPropertyOptional({ description: 'Block the customer dashboard and customer APIs.' })
  @IsOptional()
  @IsBoolean()
  customerPortal?: boolean;

  @ApiPropertyOptional({ description: 'Block the agent dashboard and agent APIs.' })
  @IsOptional()
  @IsBoolean()
  agentPortal?: boolean;

  @ApiPropertyOptional({ example: 'We are upgrading our systems. Back by 6 PM IST.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

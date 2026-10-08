import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';
import { TrafficChannel } from '../constants/analytics.constants';

export class AnalyticsRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01', description: 'Start date (inclusive), YYYY-MM-DD or ISO timestamp' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'End date (inclusive), YYYY-MM-DD or ISO timestamp' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', description: 'IANA timezone for daily / hourly buckets' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}

export class AnalyticsVisitsQueryDto extends CommonFieldsDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;

  @ApiPropertyOptional({ enum: TrafficChannel })
  @IsOptional()
  @IsEnum(TrafficChannel)
  channel?: TrafficChannel;

  @ApiPropertyOptional({ enum: ['mobile', 'tablet', 'desktop'] })
  @IsOptional()
  @IsIn(['mobile', 'tablet', 'desktop'])
  deviceType?: string;

  @ApiPropertyOptional({ enum: ['new', 'returning'] })
  @IsOptional()
  @IsIn(['new', 'returning'])
  visitorType?: 'new' | 'returning';
}

export class AnalyticsLeadsQueryDto extends CommonFieldsDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;

  @ApiPropertyOptional({ enum: [...Object.values(TrafficChannel), 'untracked'] })
  @IsOptional()
  @IsIn([...Object.values(TrafficChannel), 'untracked'])
  channel?: TrafficChannel | 'untracked';
}

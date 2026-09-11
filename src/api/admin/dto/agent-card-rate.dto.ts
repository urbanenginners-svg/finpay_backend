import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpsertAgentCardRateDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({
    example: 1.5,
    description:
      'Finpay commission over live TT (INR per unit). Agent rate X = live TT + this. Preferred.',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  finpayCommission?: number;

  @ApiPropertyOptional({
    example: 25,
    description:
      'Deprecated. If finpayCommission is omitted, treated as absolute X and converted to commission = X − live TT.',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  finpaySellRate?: number;

  @ApiPropertyOptional({
    example: 30,
    description:
      'Ignored. Card rate is always live TT (Y) + 3% and updates when TT changes.',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cardRate?: number;
}

export class BulkUpsertAgentCardRatesDto {
  @ApiProperty({ type: [UpsertAgentCardRateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertAgentCardRateDto)
  rates: UpsertAgentCardRateDto[];
}

export class GetCommissionsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageNumber?: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Admin only — filter by agent user id.',
  })
  @IsOptional()
  @IsString()
  agentId?: string;
}

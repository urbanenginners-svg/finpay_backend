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

export class UpsertCardRateMarkupDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency: string;

  @ApiProperty({
    example: 3,
    description: 'Markup percent over (live TT − paise offset) for card rate / IBR.',
    default: 3,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  markupPercent: number;
}

export class BulkUpsertCardRateMarkupsDto {
  @ApiProperty({ type: [UpsertCardRateMarkupDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertCardRateMarkupDto)
  rates: UpsertCardRateMarkupDto[];
}

export class UpdateTtPaiseOffsetDto {
  @ApiProperty({
    example: 0.08,
    description: 'INR subtracted from live TT before card-rate markup (8 paise = 0.08).',
    default: 0.08,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  ttPaiseOffset: number;
}

export class UpsertCardRateConfigDto {
  @ApiPropertyOptional({
    example: 0.08,
    description: 'Optional global TT paise offset (INR).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  ttPaiseOffset?: number;

  @ApiPropertyOptional({ type: [UpsertCardRateMarkupDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCardRateMarkupDto)
  markups?: UpsertCardRateMarkupDto[];
}

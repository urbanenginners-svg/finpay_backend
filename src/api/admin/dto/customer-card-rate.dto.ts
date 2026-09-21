import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertCustomerCardRateDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency: string;

  @ApiProperty({
    example: 'S0302',
    description:
      'LRS purpose code. Commission (and therefore sell rate X) is per purpose.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  purposeCode: string;

  @ApiPropertyOptional({
    example: 1.5,
    description:
      'Finpay commission over live TT (INR per unit) for this purpose. Customer rate X = live TT + this.',
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
}

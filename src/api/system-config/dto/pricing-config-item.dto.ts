import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PricingConfigItemDto {
  @ApiProperty({ example: 'India' })
  @IsString({ message: 'countryAName must be a string' })
  @IsNotEmpty({ message: 'countryAName is required' })
  countryAName: string;

  @ApiProperty({ example: 'United States' })
  @IsString({ message: 'countryBName must be a string' })
  @IsNotEmpty({ message: 'countryBName is required' })
  countryBName: string;

  @ApiProperty({ example: 'INR' })
  @IsString({ message: 'countryACurrency must be a string' })
  @IsNotEmpty({ message: 'countryACurrency is required' })
  countryACurrency: string;

  @ApiProperty({ example: 'USD' })
  @IsString({ message: 'countryBCurrency must be a string' })
  @IsNotEmpty({ message: 'countryBCurrency is required' })
  countryBCurrency: string;

  @ApiProperty({
    example: 0.012,
    description: 'A→B: 1 unit of country A currency = this many units of country B currency',
  })
  @IsNumber({}, { message: 'countryAPricing must be a number' })
  @Min(0, { message: 'countryAPricing must be at least 0' })
  countryAPricing: number;

  @ApiProperty({
    example: 83.5,
    description: 'B→A: 1 unit of country B currency = this many units of country A currency',
  })
  @IsNumber({}, { message: 'countryBPricing must be a number' })
  @Min(0, { message: 'countryBPricing must be at least 0' })
  countryBPricing: number;

  @ApiProperty({
    example: true,
    default: true,
    required: false,
    description: 'When false, this pair is hidden from the public GET pricing API',
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}

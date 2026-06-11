import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetPricingConfigQueryDto {
  @ApiProperty({ example: 'India', required: false })
  @IsOptional()
  @IsString({ message: 'countryAName must be a string' })
  @IsNotEmpty({ message: 'countryAName cannot be empty' })
  countryAName?: string;

  @ApiProperty({ example: 'United States', required: false })
  @IsOptional()
  @IsString({ message: 'countryBName must be a string' })
  @IsNotEmpty({ message: 'countryBName cannot be empty' })
  countryBName?: string;
}

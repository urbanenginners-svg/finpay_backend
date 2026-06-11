import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { PricingConfigItemDto } from './pricing-config-item.dto';

export class BulkUpsertPricingDto {
  @ApiProperty({
    type: [PricingConfigItemDto],
    description: 'Country-pair pricing configs to create or update in bulk',
  })
  @IsArray({ message: 'items must be an array' })
  @ArrayMinSize(1, { message: 'items must contain at least one pricing config' })
  @ValidateNested({ each: true })
  @Type(() => PricingConfigItemDto)
  items: PricingConfigItemDto[];
}

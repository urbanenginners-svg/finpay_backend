import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import {
  PrithviOrderType,
  PrithviProductType,
} from 'src/services/prithvi-exchange';

export class GetRemittanceRatesQueryDto {
  @ApiProperty({
    enum: PrithviOrderType,
    example: PrithviOrderType.BUY,
    description: 'Transaction direction: BUY or SELL',
  })
  @IsEnum(PrithviOrderType)
  orderType: PrithviOrderType;

  @ApiProperty({
    enum: PrithviProductType,
    example: PrithviProductType.TT,
    description: 'Product modality: CASH, CARD, or TT (wire transfer)',
  })
  @IsEnum(PrithviProductType)
  productType: PrithviProductType;

  @ApiPropertyOptional({
    description:
      'Agent UUID. Defaults to PRITHVI_AGENT_ID from server config when omitted.',
    example: 'a297ded2-9df0-4a48-a774-d9149a2bd954',
  })
  @IsOptional()
  @IsUUID()
  agentId?: string;
}

export class RemittanceRateResponseDto {
  @ApiProperty({ example: 'prithvi' })
  provider: string;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: 83.5 })
  rate: number;

  @ApiProperty({ example: '2026-05-18T17:40:00Z' })
  timestamp: string;

  @ApiProperty({ enum: PrithviOrderType, example: PrithviOrderType.BUY })
  orderType: PrithviOrderType;

  @ApiProperty({ enum: PrithviProductType, example: PrithviProductType.TT })
  productType: PrithviProductType;
}

export class RemittanceProviderDto {
  @ApiProperty({ example: 'prithvi' })
  id: string;

  @ApiProperty({ example: 'Prithvi Exchange' })
  name: string;

  @ApiProperty({ example: true })
  active: boolean;
}

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

  @ApiProperty({ enum: PrithviOrderType, example: PrithviOrderType.BUY })
  orderType: PrithviOrderType;

  @ApiProperty({ enum: PrithviProductType, example: PrithviProductType.TT })
  productType: PrithviProductType;

  @ApiPropertyOptional({ example: 'Agent rates fetched from cache' })
  message?: string;

  @ApiPropertyOptional({ example: 'redis' })
  source?: string;

  @ApiProperty({ example: '2026-07-13T04:29:04.577Z' })
  timestamp: string;

  @ApiProperty({
    example: '2026-07-13T04:29:04.577Z',
    description: 'When rates were last fetched from Prithvi and saved to DB.',
  })
  fetchedAt: string;

  @ApiProperty({
    example: true,
    description: 'True when served from the MongoDB cache (not a live Prithvi call).',
  })
  fromCache: boolean;

  @ApiProperty({
    type: 'array',
    example: [
      {
        currencyCode: 'USD',
        currencyName: 'US Dollar',
        rate: 115.768686,
        gstPercentage: '18.00',
        timestamp: '2026-07-13T04:29:04.577Z',
      },
    ],
  })
  currencies: RemittanceCurrencyRateDto[];
}

export class RemittanceCurrencyRateDto {
  @ApiProperty({ example: 'USD' })
  currencyCode: string;

  @ApiProperty({ example: 'US Dollar' })
  currencyName: string;

  @ApiProperty({ example: 115.768686, nullable: true })
  rate: number | null;

  @ApiProperty({ example: '18.00' })
  gstPercentage: string;

  @ApiProperty({ example: '2026-07-13T04:29:04.577Z' })
  timestamp: string;
}

export class RemittanceProviderDto {
  @ApiProperty({ example: 'prithvi' })
  id: string;

  @ApiProperty({ example: 'Prithvi Exchange' })
  name: string;

  @ApiProperty({ example: true })
  active: boolean;
}

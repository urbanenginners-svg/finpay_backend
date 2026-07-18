import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  PrithviForexRequestStatus,
  PrithviOrderType,
  PrithviProductType,
} from 'src/services/prithvi-exchange';

export class ForexOrderDetailDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency: string;

  @ApiProperty({ enum: PrithviProductType, example: PrithviProductType.CASH })
  @IsEnum(PrithviProductType)
  product: PrithviProductType;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  currencyAmount: number;

  @ApiProperty({ example: 83500 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amountInINR: number;

  @ApiProperty({
    example: 83.5,
    description: 'Selling rate from Prithvi (get-agent-rates)',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sellingRate: number;

  @ApiProperty({
    example: 83.5,
    description: 'Agent selling rate given to the customer',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  agentSellingRate: number;

  @ApiProperty({ example: 150.3 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  gst: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  serviceCharge: number;
}

export class InitiateForexRequestDto {
  @ApiProperty({ enum: PrithviOrderType, example: PrithviOrderType.BUY })
  @IsEnum(PrithviOrderType)
  orderType: PrithviOrderType;

  @ApiProperty({ type: [ForexOrderDetailDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ForexOrderDetailDto)
  orderDetails: ForexOrderDetailDto[];
}

export class CompleteForexOrderDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsString()
  @MinLength(1)
  orderId: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  travelerName: string;

  @ApiProperty({ example: '+919999988888' })
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phoneNumber: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ABCDE1234Z' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, {
    message: 'panNumber must be a valid PAN format',
  })
  panNumber: string;

  @ApiProperty({ example: 'Leisure/Holiday/Personal Visit' })
  @IsString()
  @MinLength(2)
  purpose: string;

  @ApiProperty({ example: ['USA'], type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  travelingCountries: string[];

  @ApiProperty({ example: '456 Park Avenue' })
  @IsString()
  @MinLength(5)
  deliveryAddress: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit Indian PIN' })
  pincode: string;

  @ApiProperty({ example: 'Salary' })
  @IsString()
  @MinLength(2)
  sourceOfFunds: string;

  @ApiProperty({ example: 'Doorstep' })
  @IsString()
  @MinLength(2)
  preferredDeliveryMode: string;

  @ApiProperty({ example: 'Online' })
  @IsString()
  @MinLength(2)
  preferredPaymentMode: string;

  @ApiProperty({ example: 83.5, description: 'Selling rate locked at initiate' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sellingRate: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  serviceCharge: number;

  @ApiProperty({ example: 150.3 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  gst: number;
}

export class CompleteForexRequestDto {
  @ApiProperty({ type: [CompleteForexOrderDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompleteForexOrderDto)
  orders: CompleteForexOrderDto[];
}

export class GetForexOrdersDashboardQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageNumber?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    enum: PrithviForexRequestStatus,
    example: PrithviForexRequestStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PrithviForexRequestStatus)
  status?: PrithviForexRequestStatus;

  @ApiPropertyOptional({
    enum: PrithviProductType,
    example: PrithviProductType.CASH,
  })
  @IsOptional()
  @IsEnum(PrithviProductType)
  product?: PrithviProductType;

  @ApiPropertyOptional({ example: '2026-05-01', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-05-31', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}

export class GetPurposesQueryDto {
  @ApiPropertyOptional({ enum: PrithviOrderType, example: PrithviOrderType.BUY })
  @IsOptional()
  @IsEnum(PrithviOrderType)
  orderType?: PrithviOrderType;

  @ApiPropertyOptional({
    enum: PrithviProductType,
    example: PrithviProductType.CASH,
  })
  @IsOptional()
  @IsEnum(PrithviProductType)
  productType?: PrithviProductType;
}

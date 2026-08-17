import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform } from 'class-transformer';

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

  @ApiPropertyOptional({
    example: 274.35,
    description:
      'Prithvi percentage charge (prithiviCharge) from GET /charges. Sent for PERCENTAGE lines such as GST.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prithiviCharge?: number;

  @ApiPropertyOptional({
    example: 50,
    description:
      'Delivery charge from agent charges (deliveryChargeMin when > 0). Omit when zero.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deliveryCharge?: number;

  @ApiPropertyOptional({
    example: 25,
    description:
      'Nostro charge from agent charges (nostroChargeMin when > 0). Omit when zero.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  nostroCharge?: number;
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

  @ApiProperty({
    enum: PrithviProductType,
    example: PrithviProductType.CASH,
    description: 'Product modality locked at booking: CASH, CARD, or TT',
  })
  @IsEnum(PrithviProductType)
  productType: PrithviProductType;

  @ApiPropertyOptional({
    example: 'ABCDE1234Z',
    description:
      'Optional for CASH/CARD (not collected on the booking form). Typically sent for TT.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, {
    message: 'panNumber must be a valid PAN format',
  })
  panNumber?: string;

  @ApiProperty({
    example: 'purpose-uuid-or-id',
    description: 'Prithvi purpose id from the purposes list',
  })
  @IsString()
  @MinLength(2)
  purpose: string;

  @ApiProperty({ example: ['United States', 'United Kingdom'], type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  travelingCountries: string[];

  @ApiPropertyOptional({
    example: '456 Park Avenue',
    description:
      'Optional for CASH/CARD (not collected on the booking form). Typically sent for TT.',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  deliveryAddress?: string;

  @ApiPropertyOptional({
    example: '560001',
    description:
      'Optional for CASH/CARD (not collected on the booking form). Typically sent for TT.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit Indian PIN' })
  pincode?: string;

  @ApiPropertyOptional({
    example: 'Salary',
    description:
      'Optional for CASH/CARD (not collected on the booking form). Typically sent for TT.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  sourceOfFunds?: string;

  @ApiPropertyOptional({
    example: 'Doorstep',
    description:
      'Preferred delivery mode. May come from purpose config fields; defaults may be applied by the client.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  preferredDeliveryMode?: string;

  @ApiPropertyOptional({
    example: 'Online',
    description:
      'Preferred payment mode. May come from purpose config fields; defaults may be applied by the client.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  preferredPaymentMode?: string;

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

  @ApiPropertyOptional({
    example: 274.35,
    description:
      'Prithvi percentage charge (prithiviCharge) from GET /charges. Sent for PERCENTAGE lines such as GST.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prithiviCharge?: number;

  @ApiPropertyOptional({
    example: 50,
    description:
      'Delivery charge from agent charges (deliveryChargeMin when > 0). Omit when zero.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deliveryCharge?: number;

  @ApiPropertyOptional({
    example: 25,
    description:
      'Nostro charge from agent charges (nostroChargeMin when > 0). Omit when zero.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  nostroCharge?: number;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description:
      'Travelling start date (YYYY-MM-DD). Sent for CASH/CARD from travellingStartDate.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be YYYY-MM-DD',
  })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-15',
    description:
      'Travelling end date (YYYY-MM-DD), optional. Sent for CASH/CARD from travellingEndDate.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be YYYY-MM-DD',
  })
  endDate?: string;

  // TT beneficiary fields (flattened onto the order)
  @ApiPropertyOptional({
    example: 'a297ded2-9df0-4a48-a774-d9149a2bd954',
    description: 'Prithvi beneficiary id from POST /beneficiaries (not the local Mongo _id).',
  })
  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @ApiPropertyOptional({ example: 'John Smith' })
  @IsOptional()
  @IsString()
  institutionName?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  institutionAddress?: string;

  @ApiPropertyOptional({ example: 'CHASUS33' })
  @IsOptional()
  @IsString()
  swiftCode?: string;

  @ApiPropertyOptional({ example: '021000021' })
  @IsOptional()
  @IsString()
  routingNumber?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'Chase Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '270 Park Avenue, New York' })
  @IsOptional()
  @IsString()
  beneficiaryBankAddress?: string;

  @ApiPropertyOptional({ example: 'Student ID 11212121' })
  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @ApiPropertyOptional({ example: 'Correspondent Bank' })
  @IsOptional()
  @IsString()
  interimBankName?: string;

  @ApiPropertyOptional({ example: '1 Bank Plaza' })
  @IsOptional()
  @IsString()
  interimBankAddress?: string;

  @ApiPropertyOptional({ example: 'IRVTUS3N' })
  @IsOptional()
  @IsString()
  interimBankCode?: string;

  @ApiPropertyOptional({ example: 'Belgium' })
  @IsOptional()
  @IsString()
  interimBankCountry?: string;

  @ApiPropertyOptional({ example: 'Austria' })
  @IsOptional()
  @IsString()
  benCountry?: string;

  @ApiPropertyOptional({ example: 'Father' })
  @IsOptional()
  @IsString()
  beneficiaryRelation?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null
      ? value
      : value === true || value === 'true',
  )
  @IsBoolean()
  isInterimBankSelected?: boolean;

  /**
   * Purpose-config dynamic answers (keys vary by purpose, e.g. correspondentBankCharges, asPerDoc).
   * Nested so Nest whitelist does not reject unknown purpose field keys.
   * Flattened onto the Prithvi complete payload by the forex API service.
   */
  @ApiPropertyOptional({
    description:
      'Purpose-driven dynamic field answers. Keys come from purpose config requiredFields (e.g. correspondentBankCharges, asPerDoc, passportNumber).',
    type: 'object',
    additionalProperties: true,
    example: {
      correspondentBankCharges: 'OUR',
      asPerDoc: 'Yes',
      passportNumber: 'P1234567',
    },
  })
  @IsOptional()
  @IsObject()
  purposeAnswers?: Record<string, string | boolean | number | null>;

  // Legacy purpose-driven fields (still accepted if sent top-level)
  @ApiPropertyOptional({ example: 'P1234567' })
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiPropertyOptional({ example: 'AB12C3456' })
  @IsOptional()
  @IsString()
  passportfilenumber?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsString()
  dateofbirth?: string;

  @ApiPropertyOptional({ example: 'Acme Travels Pvt Ltd' })
  @IsOptional()
  @IsString()
  businessName?: string;

  // Confirmations flattened (not nested under confirmations / fieldValues)
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  visaConfirmation?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  selfCollectionConfirm?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  currencyDeclarationConfirm?: boolean;
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

export class UploadForexOrderDocumentDto {
  @ApiProperty({
    example: 'passportFrontImage',
    description: 'documentType key from purpose config requiredDocuments',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  documentType: string;
}

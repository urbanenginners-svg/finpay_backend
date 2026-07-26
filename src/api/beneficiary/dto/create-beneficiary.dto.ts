import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateBeneficiaryDto {
  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  institutionName: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  institutionAddress: string;

  @ApiProperty({ example: 'CHASUS33' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  swiftCode: string;

  @ApiProperty({ example: '021000021' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  routingNumber: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  bankAccountNumber: string;

  @ApiProperty({ example: 'Chase Bank' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  bankName: string;

  @ApiProperty({ example: '270 Park Avenue, New York' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  beneficiaryBankAddress: string;

  @ApiPropertyOptional({ example: 'Student ID 11212121' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  additionalInfo?: string;

  @ApiProperty({ example: 'Austria' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  benCountry: string;

  @ApiProperty({ example: 'Father' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  beneficiaryRelation: string;

  @ApiProperty({ example: false })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isInterimBankSelected: boolean;

  @ApiPropertyOptional({ example: 'Correspondent Bank' })
  @ValidateIf((o: CreateBeneficiaryDto) => o.isInterimBankSelected === true)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  interimBankName?: string;

  @ApiPropertyOptional({ example: '1 Bank Plaza' })
  @ValidateIf((o: CreateBeneficiaryDto) => o.isInterimBankSelected === true)
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  interimBankAddress?: string;

  @ApiPropertyOptional({ example: 'IRVTUS3N' })
  @ValidateIf((o: CreateBeneficiaryDto) => o.isInterimBankSelected === true)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  interimBankCode?: string;

  @ApiPropertyOptional({ example: 'Belgium' })
  @ValidateIf((o: CreateBeneficiaryDto) => o.isInterimBankSelected === true)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  interimBankCountry?: string;
}

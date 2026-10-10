import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Annexure A commissions are taken from the agent's card rates, not from this payload. */
export class UpsertAgentAgreementDto {
  @ApiProperty({ example: 'R. K. Enterprises' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Firm name is required' })
  @MaxLength(200)
  firmName: string;

  @ApiProperty({ example: 'Ground Floor, Shop No.1, Sunshine Market, Hoshiarpur, Punjab-146001' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Firm address is required' })
  @MaxLength(500)
  firmAddress: string;

  @ApiProperty({ example: 'Rajinder Kumar' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Signatory name is required' })
  @MaxLength(120)
  signatoryName: string;

  @ApiProperty({ example: 'Authorized Signatory' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Signatory designation is required' })
  @MaxLength(120)
  signatoryDesignation: string;

  @ApiProperty({ example: '2026-09-26' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Commencement date must be YYYY-MM-DD' })
  commencementDate: string;
}

export class AcceptAgentAgreementDto {
  @ApiProperty({ description: 'Agreement version the agent reviewed' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({ example: 'Rajinder Kumar', description: 'Typed full name as digital signature' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Type your full name to sign' })
  @MaxLength(120)
  signedName: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: 'You must agree to the terms to accept the agreement' })
  agreed: boolean;
}

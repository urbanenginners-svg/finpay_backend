import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';

export class RegisterInitDto {
  @ApiProperty({ enum: UserTypeEnum })
  @IsEnum(UserTypeEnum)
  userType: UserTypeEnum;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian mobile number' })
  phoneNumber: string;

  @ApiProperty({ example: '1990-01-15' })
  @IsDateString()
  dateOfBirth: string;
}

export class RegisterVerifyOtpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  registrationToken: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Length(4, 6)
  otp: string;
}

export class VerifyAadhaarDto {
  @ApiProperty({ example: '123456789012' })
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhaar number must be 12 digits' })
  aadhaarNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class PrivateLimitedDocumentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moaAoa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateOfIncorporation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstCertificate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressProof?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyPanCard?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankCancelCheque?: string;
}

export class CompleteUserRegistrationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  registrationToken: string;

  @ApiProperty({ example: '123456789012' })
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhaar number must be 12 digits' })
  aadhaarNumber: string;

  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'PAN must be in valid format (e.g. ABCDE1234F)' })
  panCardNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aadhaarVerificationRef?: string;
}

export class CompleteAgentRegistrationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  registrationToken: string;

  @ApiProperty({ example: '123456789012' })
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhaar number must be 12 digits' })
  aadhaarNumber: string;

  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'PAN must be in valid format (e.g. ABCDE1234F)' })
  panCardNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aadhaarVerificationRef?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  udhyamAadhaarCertificate: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bankCancelCheque: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gstCertificate: string;

  @ApiProperty()
  @IsBoolean()
  isPrivateLimited: boolean;

  @ApiPropertyOptional({ type: PrivateLimitedDocumentsDto })
  @ValidateIf((o) => o.isPrivateLimited === true)
  @ValidateNested()
  @Type(() => PrivateLimitedDocumentsDto)
  privateLimitedDocuments?: PrivateLimitedDocumentsDto;
}

export class LoginSendOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian mobile number' })
  phoneNumber: string;
}

export class LoginVerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian mobile number' })
  phoneNumber: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Length(4, 6)
  otp: string;
}

export class VerifyAgentDto {
  @ApiProperty()
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.approved === false)
  @IsString()
  @IsNotEmpty()
  rejectionReason?: string;
}

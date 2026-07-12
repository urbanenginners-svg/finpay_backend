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
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';

export class RegisterInitDto {
  @ApiProperty({ enum: UserTypeEnum })
  @IsEnum(UserTypeEnum)
  userType: UserTypeEnum;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

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

  @ApiProperty({ example: 'StrongPassword@123', description: 'Account password (min 8 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

export class UpdateRegistrationStep1Dto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

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

  @ApiPropertyOptional({
    example: 'StrongPassword@123',
    description: 'Leave empty to keep the current password',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;
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
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class VerifyPanDto {
  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'PAN must be in valid format (e.g. ABCDE1234F)' })
  panCardNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Full name as on PAN card. If omitted, firstName is used; when lastName is provided, firstName + lastName are used.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class VerifyPassportDto {
  @ApiProperty({ example: 'PA1079341954215', description: 'Passport file number' })
  @IsString()
  @IsNotEmpty()
  fileNumber: string;

  @ApiProperty({ example: 'John Doe', description: 'Applicant full name as on passport' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2007-03-01', description: 'Date of birth (YYYY-MM-DD)' })
  @IsDateString()
  dob: string;
}

export class PrivateLimitedDocumentsDto {
  @ApiPropertyOptional({
    example: 'file::123e4567-e89b-12d3-a456-426614174020',
    description: 'File ID from POST /files/upload',
  })
  @IsOptional()
  @IsString()
  moaAoa?: string;

  @ApiPropertyOptional({
    example: 'file::123e4567-e89b-12d3-a456-426614174021',
    description: 'File ID from POST /files/upload',
  })
  @IsOptional()
  @IsString()
  certificateOfIncorporation?: string;

  @ApiPropertyOptional({
    example: 'file::123e4567-e89b-12d3-a456-426614174022',
    description: 'File ID from POST /files/upload',
  })
  @IsOptional()
  @IsString()
  gstCertificate?: string;

  @ApiPropertyOptional({
    example: 'file::123e4567-e89b-12d3-a456-426614174023',
    description: 'File ID from POST /files/upload',
  })
  @IsOptional()
  @IsString()
  addressProof?: string;

  @ApiPropertyOptional({
    example: 'file::123e4567-e89b-12d3-a456-426614174024',
    description: 'File ID from POST /files/upload',
  })
  @IsOptional()
  @IsString()
  companyPanCard?: string;

  @ApiPropertyOptional({
    example: 'file::123e4567-e89b-12d3-a456-426614174025',
    description: 'File ID from POST /files/upload',
  })
  @IsOptional()
  @IsString()
  bankCancelCheque?: string;
}

export class CompleteUserRegistrationDto {
  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'PAN must be in valid format (e.g. ABCDE1234F)' })
  panCardNumber: string;

  @ApiProperty({ example: 'PA1079341954215' })
  @IsString()
  @IsNotEmpty()
  passportFileNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panVerificationRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportVerificationRef?: string;
}

/** Text fields for multipart agent registration (document files are uploaded separately). */
export class CompleteAgentRegistrationDto {
  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'PAN must be in valid format (e.g. ABCDE1234F)' })
  panCardNumber: string;

  @ApiProperty({ example: 'PA1079341954215' })
  @IsString()
  @IsNotEmpty()
  passportFileNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panVerificationRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportVerificationRef?: string;

  @ApiProperty({
    example: 'file::123e4567-e89b-12d3-a456-426614174010',
    description: 'File ID from POST /files/upload',
  })
  @IsString()
  @IsNotEmpty()
  udhyamAadhaarCertificate: string;

  @ApiProperty({
    example: 'file::123e4567-e89b-12d3-a456-426614174011',
    description: 'File ID from POST /files/upload',
  })
  @IsString()
  @IsNotEmpty()
  bankCancelCheque: string;

  @ApiProperty({
    example: 'file::123e4567-e89b-12d3-a456-426614174012',
    description: 'File ID from POST /files/upload',
  })
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

export class PasswordLoginDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Email address or 10-digit Indian mobile number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or mobile number is required' })
  identifier: string;

  @ApiProperty({ example: 'StrongPassword@123' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
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

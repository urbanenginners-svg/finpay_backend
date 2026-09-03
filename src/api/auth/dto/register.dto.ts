import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
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
import { AgentTypeEnum } from 'src/utils/enums/agent-type.enum';

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

  @ApiPropertyOptional({ example: '1990-01-15', description: 'Required for agent passport verification' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

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

  @ApiPropertyOptional({ example: '1990-01-15', description: 'Required for agent passport verification' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

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

export class AgentRegistrationDocumentsDto {
  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  panCard?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  idProof?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  photograph?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  bankAccountProof?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  businessAddressProof?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  proprietorPanCard?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  proprietorIdProof?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  proprietorPhotograph?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  gstCertificate?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  firmBankAccountProof?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  firmPanCard?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  authorisedPartnerIdProof?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  authorisedPartnerPhotograph?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  partnershipDeed?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  authorisationLetter?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  certificateOfIncorporation?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  companyPanCard?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  moaAoa?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  companyBankAccountProof?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  directorPanCard?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  directorIdProof?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  directorPhotograph?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  boardResolution?: string;

  @ApiPropertyOptional({ description: 'File ID from POST /files/upload' })
  @IsOptional()
  @IsString()
  beneficialOwnerDetails?: string;
}

export class CompleteUserRegistrationDto {}

/** Document files are uploaded separately via POST /files/upload. */
export class CompleteAgentRegistrationDto {
  @ApiProperty({ enum: AgentTypeEnum })
  @IsEnum(AgentTypeEnum)
  agentType: AgentTypeEnum;

  @ApiProperty({ type: AgentRegistrationDocumentsDto })
  @ValidateNested()
  @Type(() => AgentRegistrationDocumentsDto)
  documents: AgentRegistrationDocumentsDto;
}

export class ResubmitAgentDocumentsDto {
  @ApiProperty({
    description: 'Map of document key to file ID for each item requested by admin',
    example: {
      panCard: 'file::123e4567-e89b-12d3-a456-426614174010',
      additional_shop_certificate_1710000000: 'file::123e4567-e89b-12d3-a456-426614174011',
    },
  })
  @IsObject()
  documents: Record<string, string>;
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

export class ForgotPasswordDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Email address or 10-digit Indian mobile number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or mobile number is required' })
  identifier: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Email address or 10-digit Indian mobile number used for forgot password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or mobile number is required' })
  identifier: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Length(4, 6)
  otp: string;

  @ApiProperty({
    example: 'StrongPassword@123',
    description: 'New password (min 8 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

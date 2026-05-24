import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { TrimString } from 'src/utils/transforms/trim-string.transform';
import { isValidPhoneNumber } from 'src/utils/helpers/phone.helper';

@ValidatorConstraint({ name: 'isValidMobile', async: false })
class IsValidMobileConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return typeof value === 'string' && isValidPhoneNumber(value);
  }

  defaultMessage(): string {
    return 'Mobile must be a valid phone number with at least 10 digits';
  }
}

export class ContactDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiProperty({ example: '9876543210' })
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'Mobile is required' })
  @Validate(IsValidMobileConstraint)
  mobile: string;

  @ApiProperty({ example: 'rahul@example.com' })
  @TrimString()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: false, default: false, required: false })
  @IsOptional()
  @IsBoolean({ message: 'callbackRequested must be a boolean' })
  @Transform(({ value }) => (value === undefined || value === null ? false : value))
  callbackRequested: boolean;
}

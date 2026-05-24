import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Mobile number with country code',
  })
  @IsString()
  @IsNotEmpty()
  // @IsPhoneNumber() // Can add specific region if needed
  phoneNumber: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Mobile number with country code',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    example: '1234',
    description: 'One Time Password (4 digits)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 4, { message: 'OTP must be exactly 4 digits' })
  otp: string;
}

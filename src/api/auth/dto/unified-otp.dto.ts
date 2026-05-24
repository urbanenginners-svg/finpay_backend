import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';

import { OtpPortalType } from 'src/utils/enums/otp-portal-type.enum';

export class SendUnifiedOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Mobile number with country code',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    enum: OtpPortalType,
    example: OtpPortalType.WAREHOUSE_ASSOCIATE,
    description:
      'Which app/portal is logging in. Staff portals require an existing provisioned account.',
  })
  @IsEnum(OtpPortalType)
  userType: OtpPortalType;
}

export class VerifyUnifiedOtpDto extends SendUnifiedOtpDto {
  @ApiProperty({
    example: '1234',
    description: 'One-time password sent to the phone number (4 digits)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 4, { message: 'OTP must be exactly 4 digits' })
  otp: string;
}

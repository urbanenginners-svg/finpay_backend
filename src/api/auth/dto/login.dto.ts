import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'superadmin@sbzee.com',
    description: 'Email address of the user',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'SuperAdmin@123',
    description: 'Password of the user',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

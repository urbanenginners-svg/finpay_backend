import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    example: 'John',
    description: 'First name of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address of the user',
    required: false,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Phone number of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    example: 'file::123e4567-e89b-12d3-a456-426614174010',
    description: 'Profile picture file ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePic?: string;

  @ApiProperty({
    example: 'NewStrongPassword@123',
    description: 'New password (min 8 characters)',
    required: false,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsOptional()
  password?: string;

  @ApiProperty({
    example: 'role::123e4567-e89b-12d3-a456-426614174000',
    description: 'Role ID to assign to the user',
    type: String,
    required: false,
  })
  @IsString({ message: 'Role ID must be a string' })
  @IsOptional()
  role?: string;
}

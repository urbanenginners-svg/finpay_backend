import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'John',
    description: 'First name of the user',
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name of the user',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address of the user (must be unique)',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

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
    description: 'Optional profile picture file ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePic?: string;

  @ApiProperty({
    example: 'StrongPassword@123',
    description: 'Password for the user account (min 8 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    example: 'role::123e4567-e89b-12d3-a456-426614174000',
    description: 'Role ID to assign to the user',
    type: String,
  })
  @IsString({ message: 'Role ID must be a string' })
  @IsNotEmpty({ message: 'Role is required' })
  role: string;
}

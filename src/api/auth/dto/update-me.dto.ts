import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateMeDto {
  @ApiProperty({ example: 'John', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    example: 'file::123e4567-e89b-12d3-a456-426614174010',
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
}

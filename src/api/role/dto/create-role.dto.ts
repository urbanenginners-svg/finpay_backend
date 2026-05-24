import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    example: 'Super Admin',
    description: 'Display name of the role',
  })
  @IsString()
  @IsNotEmpty({ message: 'Role name is required' })
  name: string;

  @ApiProperty({
    example: 'Administrator with full access',
    description: 'Optional description of the role',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    type: [String],
    example: ['perm::123e4567-e89b-12d3-a456-426614174000'],
    description: 'Array of permission IDs to assign to this role',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

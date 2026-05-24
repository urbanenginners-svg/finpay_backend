import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({
    example: 'Administrator with full access',
    description: 'Updated description of the role',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    type: [String],
    example: ['perm::123e4567-e89b-12d3-a456-426614174000'],
    description: 'Updated array of permission IDs for this role',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

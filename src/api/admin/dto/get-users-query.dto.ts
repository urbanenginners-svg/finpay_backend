import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';

export class GetUsersQueryDto extends CommonFieldsDto {
  @ApiProperty({
    example: 'role::123e4567-e89b-12d3-a456-426614174000',
    description: 'Filter users by Role ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  roleId?: string;

  @ApiProperty({
    example: 'admin',
    description: 'Filter users by role name or slug (case-insensitive)',
    required: false,
  })
  @IsString()
  @IsOptional()
  roleName?: string;
}

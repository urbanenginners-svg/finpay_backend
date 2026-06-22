import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';
import { RegistrationStatusEnum } from 'src/utils/enums/registration-status.enum';

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
    example: 'agent',
    description: 'Filter users by role name or slug (case-insensitive)',
    required: false,
  })
  @IsString()
  @IsOptional()
  roleName?: string;

  @ApiProperty({
    enum: RegistrationStatusEnum,
    example: RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION,
    description: 'Filter users by registration status',
    required: false,
  })
  @IsEnum(RegistrationStatusEnum)
  @IsOptional()
  registrationStatus?: RegistrationStatusEnum;
}

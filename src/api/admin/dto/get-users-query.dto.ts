import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';
import { RegistrationStatusEnum } from 'src/utils/enums/registration-status.enum';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';

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

  @ApiProperty({
    example: '2025-01-01',
    description: 'Filter users created on or after this date (YYYY-MM-DD)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiProperty({
    example: '2025-12-31',
    description: 'Filter users created on or before this date (YYYY-MM-DD)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiProperty({
    enum: UserTypeEnum,
    example: UserTypeEnum.USER,
    description: 'Filter users by user type',
    required: false,
  })
  @IsEnum(UserTypeEnum)
  @IsOptional()
  userType?: UserTypeEnum;

  @ApiProperty({
    example: 'pending_otp,step1_complete',
    description: 'Filter users by multiple registration statuses (comma-separated)',
    required: false,
  })
  @IsString()
  @IsOptional()
  registrationStatusIn?: string;
}

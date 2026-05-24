import { ApiProperty } from '@nestjs/swagger';

export class MePermissionDto {
  @ApiProperty({ example: 'perm::123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'write', enum: ['read', 'write', 'update', 'delete'] })
  action: string;

  @ApiProperty({ example: 'product' })
  resource: string;

  @ApiProperty({ example: 'product:write' })
  slug: string;
}

export class MeRoleDto {
  @ApiProperty({ example: 'role::123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Admin' })
  name: string;

  @ApiProperty({ example: 'admin' })
  slug: string;

  @ApiProperty({ example: 'Administrator role with full access', required: false })
  description?: string;

  @ApiProperty({ type: [MePermissionDto] })
  permissions: MePermissionDto[];
}

export class MeResponseDto {
  @ApiProperty({ example: 'user::123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: '+919876543210', required: false })
  phoneNumber?: string;

  @ApiProperty({
    example: 'file::123e4567-e89b-12d3-a456-426614174010',
    required: false,
  })
  profilePic?: string;

  @ApiProperty({ type: MeRoleDto, required: false })
  role?: MeRoleDto;

  @ApiProperty({ example: 'warehouse::123e4567-e89b-12d3-a456-426614174000', required: false })
  warehouse?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ required: false })
  createdBy?: string;

  @ApiProperty({ required: false })
  lastUpdatedBy?: string;

  @ApiProperty({ required: false })
  deletedAt?: Date;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}

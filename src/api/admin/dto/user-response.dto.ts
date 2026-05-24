import { ApiProperty } from '@nestjs/swagger';

export class RoleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description?: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  profilePic?: string;

  @ApiProperty({ type: RoleDto })
  role: RoleDto;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdBy?: string;

  @ApiProperty()
  lastUpdatedBy?: string;

  @ApiProperty()
  deletedBy?: string;

  @ApiProperty()
  deletedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

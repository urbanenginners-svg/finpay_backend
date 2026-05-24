import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ example: 'role::123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Super Admin' })
  name: string;

  @ApiProperty({ example: 'super-admin' })
  slug: string;

  @ApiProperty({ required: false, example: 'Administrator with full access' })
  description?: string;

  @ApiProperty({ type: [String], example: [] })
  permissions: string[];

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

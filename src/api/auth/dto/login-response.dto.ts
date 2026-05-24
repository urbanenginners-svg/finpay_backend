import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  access_token: string;

  @ApiProperty({
    example: 'superadmin',
    description: 'User ID',
  })
  userId: string;

  @ApiProperty({
    example: 'superadmin@sbzee.com',
    description: 'User email',
  })
  email: string;

  @ApiProperty({
    example: 'Super',
    description: 'User first name',
  })
  firstName: string;

  @ApiProperty({
    example: 'Admin',
    description: 'User last name',
  })
  lastName: string;

  @ApiProperty({
    example: 'file::123e4567-e89b-12d3-a456-426614174010',
    description: 'Optional profile picture file ID',
    required: false,
  })
  profilePic?: string;

  @ApiProperty({
    example: ['Super Admin'],
    description: 'User roles',
    type: [String],
  })
  roles: string[];
}

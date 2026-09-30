import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BlockUserDto {
  @ApiProperty({
    example: 'Suspected fraudulent activity',
    description: 'Internal note for admins. It is never shown to the blocked user.',
    required: false,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

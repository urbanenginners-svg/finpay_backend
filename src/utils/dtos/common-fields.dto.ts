import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CommonFieldsDto {
  @ApiProperty({
    type: String,
  })
  @IsOptional()
  @IsString()
  limit?: number;

  @ApiProperty({
    type: String,
  })
  @IsOptional()
  @IsString()
  page?: number;

  @ApiProperty({
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: 'Filter by active status. Pass true for active, false for inactive.',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}

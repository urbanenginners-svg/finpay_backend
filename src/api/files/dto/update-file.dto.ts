import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FileResourceEnum } from 'src/utils/enums/file-resource.enum';

export class UpdateFileDto {
  @ApiProperty({
    enum: FileResourceEnum,
    example: FileResourceEnum.VENDOR,
    description: 'The resource/entity type this file belongs to',
    required: false,
  })
  @IsEnum(FileResourceEnum)
  @IsOptional()
  type?: FileResourceEnum;

  @ApiProperty({
    example: 'vendor::123e4567-e89b-12d3-a456-426614174000',
    description: 'Optional ID of the entity this file is associated with',
    required: false,
  })
  @IsString()
  @IsOptional()
  referenceId?: string;
}

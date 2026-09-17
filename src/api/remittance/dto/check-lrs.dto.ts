import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CheckLrsDto {
  @ApiProperty({
    example: 'ABCPV1234D',
    description: 'PAN number to check Liberalised Remittance Scheme utilisation.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: 'pan must be a valid PAN format',
  })
  pan: string;
}

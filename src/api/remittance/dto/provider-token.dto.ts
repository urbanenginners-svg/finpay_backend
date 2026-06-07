import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';

export class ProviderTokenStatusQueryDto {
  @ApiPropertyOptional({
    description:
      'When true, validates the stored access token against the Prithvi introspect API.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  introspect?: boolean;
}

export class ProviderTokenActionResponseDto {
  @ApiProperty({ enum: RemittanceProvider, example: RemittanceProvider.PRITHVI })
  provider: RemittanceProvider;

  @ApiProperty({ example: true })
  stored: boolean;

  @ApiProperty({ example: 86400 })
  expiresIn: number;

  @ApiProperty({ example: '2026-06-08T12:00:00.000Z' })
  expiresAt: string;

  @ApiPropertyOptional({ example: 'read write' })
  scope?: string;

  @ApiPropertyOptional({ example: 'Bearer' })
  tokenType?: string;
}

export class ProviderTokenIntrospectionDto {
  @ApiProperty({ example: true })
  active: boolean;

  @ApiPropertyOptional({ example: 'client_1627505' })
  sub?: string;

  @ApiPropertyOptional({ example: 'read write' })
  scope?: string;

  @ApiPropertyOptional({ example: 1716035048 })
  exp?: number;
}

export class ProviderTokenStatusResponseDto {
  @ApiProperty({ enum: RemittanceProvider, example: RemittanceProvider.PRITHVI })
  provider: RemittanceProvider;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ example: true })
  stored: boolean;

  @ApiPropertyOptional({ example: '2026-06-08T12:00:00.000Z' })
  expiresAt?: string;

  @ApiPropertyOptional({ example: 82000 })
  expiresInSeconds?: number;

  @ApiPropertyOptional({ example: false })
  isExpired?: boolean;

  @ApiPropertyOptional({ example: 'read write' })
  scope?: string;

  @ApiPropertyOptional({ example: 'Bearer' })
  tokenType?: string;

  @ApiPropertyOptional({ type: ProviderTokenIntrospectionDto })
  introspection?: ProviderTokenIntrospectionDto;

  @ApiPropertyOptional({
    example:
      'No token in database. Call POST /api/v1/remittance/providers/prithvi/token to create one.',
  })
  message?: string;
}

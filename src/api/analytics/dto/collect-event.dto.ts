import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CollectEventDto {
  @ApiProperty({ description: 'Random first-party visitor ID (UUID v4) kept in localStorage' })
  @IsUUID('4')
  visitorId: string;

  @ApiProperty({ description: 'Random session ID (UUID v4), rotated after 30 minutes of inactivity' })
  @IsUUID('4')
  sessionId: string;

  @ApiProperty({ example: '/enquiry', description: 'Page path without query string' })
  @IsString()
  @Matches(/^\/[^\s?#]*$/, { message: 'path must be a URL path starting with /' })
  @MaxLength(300)
  path: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'document.referrer, sent on the first page view of a session' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  referrer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmMedium?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmCampaign?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmTerm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmContent?: string;

  @ApiPropertyOptional({ example: 'en-IN' })
  @IsOptional()
  @IsString()
  @MaxLength(35)
  language?: string;

  @ApiPropertyOptional({ example: '1440x900' })
  @IsOptional()
  @Matches(/^\d{2,5}x\d{2,5}$/)
  screen?: string;
}

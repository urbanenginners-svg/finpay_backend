import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AgentTypeEnum } from 'src/utils/enums/agent-type.enum';
import { AgentRegistrationDocumentsDto } from '../../auth/dto/register.dto';

/**
 * Admin creates an agent on their behalf (when the agent cannot self-register).
 * A temporary password is generated (or optional admin-provided) and emailed to the agent.
 */
export class CreateAgentDto {
  @ApiProperty({ example: 'Rahul' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'rahul.agent@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone number must be a valid 10-digit Indian mobile number',
  })
  phoneNumber: string;

  @ApiPropertyOptional({
    example: '1990-01-15',
    description: 'Optional date of birth (YYYY-MM-DD)',
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ enum: AgentTypeEnum })
  @IsEnum(AgentTypeEnum)
  agentType: AgentTypeEnum;

  @ApiProperty({ type: AgentRegistrationDocumentsDto })
  @ValidateNested()
  @Type(() => AgentRegistrationDocumentsDto)
  documents: AgentRegistrationDocumentsDto;

  @ApiPropertyOptional({
    example: 'TempPass@123',
    description:
      'Optional password (min 8). If omitted, a secure temporary password is generated and emailed.',
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;
}

import { IsOptional, IsString } from "class-validator";

export class QueryCommonFields {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  limit?: number;

  @IsOptional()
  @IsString()
  page?: number;

  @IsOptional()
  isActive?: boolean;
}

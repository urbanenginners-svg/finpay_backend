import { ApiProperty } from "@nestjs/swagger";
import { IsArray } from "class-validator";
import { PageMeta } from "./page-meta";

export class DataResponse<T> {
  readonly data: T;

  readonly message?: string;

  readonly code?: string;

  constructor(data: T, message?: string, code?: string) {
    this.data = data;
    this.message = message;
    this.code = code;
  }
}

export type PromisedDataResponse<T> = Promise<DataResponse<T>>;

export class PaginatedDataResponse<T> {
  @IsArray()
  @ApiProperty({ isArray: true })
  readonly data: T[];

  @ApiProperty({ type: () => PageMeta })
  readonly meta: PageMeta;

  @ApiProperty({ type: "string" })
  readonly code?: string;

  constructor(data: T[], meta: PageMeta, code?: string) {
    this.data = data;
    this.meta = meta;
    this.code = code;
  }
}

export type PromisedPageData<T> = Promise<PaginatedDataResponse<T>>;

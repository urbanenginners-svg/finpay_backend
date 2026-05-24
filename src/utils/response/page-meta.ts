import { ApiProperty } from "@nestjs/swagger";
import { QueryCommonFields } from "../interfaces/query-fields.interface";

export class PageMeta {
  @ApiProperty()
  readonly page: number;

  @ApiProperty()
  readonly limit: number;

  @ApiProperty()
  readonly itemCount: number;

  @ApiProperty()
  readonly pageCount: number;

  @ApiProperty()
  readonly hasPreviousPage: boolean;

  @ApiProperty()
  readonly hasNextPage: boolean;

  constructor(itemCount: number, dto?: QueryCommonFields) {
    this.page = dto && dto.page ? Number(dto.page) : 1;
    this.limit = dto && dto.limit ? Number(dto.limit) : itemCount;
    this.itemCount = itemCount;
    this.pageCount = Math.ceil(this.itemCount / this.limit);
    this.hasPreviousPage = this.page > 1;
    this.hasNextPage = this.page < this.pageCount;
  }
}

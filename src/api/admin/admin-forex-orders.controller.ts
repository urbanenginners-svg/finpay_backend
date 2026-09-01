import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

import {
  GetAdminForexOrdersQuery,
  RemittanceService,
} from '../remittance/remittance.service';
import {
  PrithviForexRequestStatus,
  PrithviProductType,
} from 'src/services/prithvi-exchange';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { DataResponse } from 'src/utils/response';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class GetAdminForexOrdersQueryDto implements GetAdminForexOrdersQuery {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageNumber?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({ enum: PrithviForexRequestStatus })
  @IsOptional()
  @IsEnum(PrithviForexRequestStatus)
  status?: PrithviForexRequestStatus;

  @ApiPropertyOptional({ enum: PrithviProductType })
  @IsOptional()
  @IsEnum(PrithviProductType)
  product?: PrithviProductType;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter to a specific Finpay user id',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  createdByUserId?: string;

  @ApiPropertyOptional({
    description: 'Search order code, traveler, email, phone, or user id',
  })
  @IsOptional()
  @IsString()
  q?: string;
}

class UpdateAdminForexOrderStatusDto {
  @ApiProperty({ enum: PrithviForexRequestStatus })
  @IsEnum(PrithviForexRequestStatus)
  status: PrithviForexRequestStatus;
}

@ApiTags('Admin - Forex Orders')
@ApiBearerAuth()
@Controller('admin/forex/orders')
@UseGuards(PoliciesGuard)
export class AdminForexOrdersController {
  constructor(private readonly remittanceService: RemittanceService) {}

  @Version('1')
  @Get()
  @ApiOperation({
    summary: 'List all forex bookings',
    description:
      'Returns Finpay-booked forex orders across all users, with booking owner details.',
  })
  @ApiQuery({ name: 'pageNumber', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: PrithviForexRequestStatus })
  @ApiQuery({ name: 'product', required: false, enum: PrithviProductType })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'createdByUserId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async listOrders(@Query() query: GetAdminForexOrdersQueryDto) {
    const result =
      await this.remittanceService.getAdminForexOrdersDashboard(query);
    return {
      data: result.data,
      meta: result.meta,
      message: 'Forex orders retrieved successfully.',
    };
  }

  @Version('1')
  @Post('sync')
  @ApiOperation({
    summary: 'Manually sync forex orders from provider',
    description:
      'Pulls the provider dashboard and updates matching local bookings by order id.',
  })
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async syncOrders() {
    const result = await this.remittanceService.syncForexOrdersNow();
    return new DataResponse(
      result,
      `Synced forex orders: ${result.rowsMatched} of ${result.rowsSeen} matched.`,
    );
  }

  @Version('1')
  @Get(':orderId')
  @ApiOperation({
    summary: 'Get forex order detail',
    description:
      'Returns the full booking record for a single order, including owner profile.',
  })
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async getOrderDetail(@Param('orderId') orderId: string) {
    const data = await this.remittanceService.getAdminForexOrderDetail(orderId);
    return new DataResponse(data, 'Forex order retrieved successfully.');
  }

  @Version('1')
  @Patch(':orderId/status')
  @ApiOperation({
    summary: 'Set local forex order status',
    description:
      'Updates status in Finpay MongoDB without calling the provider. Set DOCUMENTS_APPROVED_AWAITING_FUNDS to unlock payment for the user. Sends email/SMS when status changes (payment notify on that status).',
  })
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateAdminForexOrderStatusDto,
  ) {
    const data = await this.remittanceService.updateForexOrderStatus(
      orderId,
      dto.status,
    );
    return new DataResponse(
      data,
      data.statusChanged
        ? `Order status updated to ${data.status}.`
        : `Order is already ${data.status}.`,
    );
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Res,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AgentCardRateService } from 'src/services/agent-card-rate/agent-card-rate.service';
import { PrithviForexOrderService } from 'src/services/prithvi-exchange/prithvi-forex-order.service';
import { RemittanceService } from '../remittance/remittance.service';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { DataResponse } from 'src/utils/response';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import {
  BulkUpsertAgentCardRatesDto,
  GetCommissionsQueryDto,
  UpsertAgentCardRateDto,
} from './dto/agent-card-rate.dto';

function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

@ApiTags('Admin - Agent Card Rates & Commissions')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PoliciesGuard)
export class AdminAgentCardRatesController {
  constructor(
    private readonly cardRates: AgentCardRateService,
    private readonly forexOrders: PrithviForexOrderService,
    private readonly remittanceService: RemittanceService,
  ) {}

  @Version('1')
  @Get('agents/:agentId/card-rates')
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async listCardRates(@Param('agentId') agentId: string) {
    const data = await this.cardRates.listByAgent(agentId);
    return new DataResponse(data);
  }

  @Version('1')
  @Put('agents/:agentId/card-rates')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async upsertCardRate(
    @Param('agentId') agentId: string,
    @Body() dto: UpsertAgentCardRateDto,
    @GetUser('_id') adminId: string,
  ) {
    const liveTtRate = await this.remittanceService.getLiveTtBuyRate(
      dto.currency,
    );
    const finpaySellRate = dto.finpaySellRate ?? 0;
    if (liveTtRate > 0 && finpaySellRate > 0 && finpaySellRate < liveTtRate) {
      throw new BadRequestException(
        'Finpay sell rate (X) cannot be below the live TT rate (Y).',
      );
    }
    const data = await this.cardRates.upsertRate({
      agentId,
      currency: dto.currency,
      vendorRate: liveTtRate,
      finpaySellRate,
      cardRate: dto.cardRate ?? 0,
      updatedByAdminId: String(adminId),
    });
    return new DataResponse(data, 'Card rate saved.');
  }

  @Version('1')
  @Put('agents/:agentId/card-rates/bulk')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async bulkUpsertCardRates(
    @Param('agentId') agentId: string,
    @Body() dto: BulkUpsertAgentCardRatesDto,
    @GetUser('_id') adminId: string,
  ) {
    const data = await this.cardRates.bulkUpsert(
      agentId,
      await Promise.all(
        dto.rates.map(async (rate) => {
          const liveTtRate = await this.remittanceService.getLiveTtBuyRate(
            rate.currency,
          );
          const finpaySellRate = rate.finpaySellRate ?? 0;
          if (
            liveTtRate > 0 &&
            finpaySellRate > 0 &&
            finpaySellRate < liveTtRate
          ) {
            throw new BadRequestException(
              `${rate.currency}: Finpay sell rate (X) cannot be below the live TT rate (Y).`,
            );
          }
          return {
            currency: rate.currency,
            vendorRate: liveTtRate,
            finpaySellRate,
            cardRate: rate.cardRate ?? 0,
          };
        }),
      ),
      String(adminId),
    );
    return new DataResponse(data, 'Card rates saved.');
  }

  @Version('1')
  @Delete('agents/:agentId/card-rates/:currency')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async deleteCardRate(
    @Param('agentId') agentId: string,
    @Param('currency') currency: string,
  ) {
    await this.cardRates.deleteRate(agentId, currency);
    return new DataResponse(null, 'Card rate deleted.');
  }

  @Version('1')
  @Get('commissions')
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async listCommissions(@Query() query: GetCommissionsQueryDto) {
    const result = await this.remittanceService.listAdminCommissions({
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      fromDate: query.fromDate,
      toDate: query.toDate,
      currency: query.currency,
      agentId: query.agentId,
    });
    return new DataResponse(result);
  }

  @Version('1')
  @Get('commissions/export')
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async exportCommissionsCsv(
    @Query() query: GetCommissionsQueryDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="finpay-commissions.csv"',
    );

    const header = [
      'orderId',
      'orderCode',
      'agentId',
      'currency',
      'product',
      'status',
      'currencyAmount',
      'vendorRate_Y',
      'finpaySellRate_X',
      'cardRate',
      'customerSellRate_Z',
      'finpayCommissionPerUnit',
      'agentCommissionPerUnit',
      'finpayCommissionTotal',
      'agentCommissionTotal',
      'providerCreatedAt',
    ].join(',');
    res.write(`${header}\n`);

    for await (const row of this.forexOrders.iterateCommissionsForExport({
      fromDate: query.fromDate,
      toDate: query.toDate,
      currency: query.currency,
      createdByUserId: query.agentId,
      agentBookingsOnly: true,
    })) {
      res.write(
        [
          row.id,
          row.orderCode,
          row.createdByUserId,
          row.currency,
          row.product,
          row.status,
          row.currencyAmount,
          row.vendorRate,
          row.finpaySellRate,
          row.cardRate,
          row.customerSellRate,
          row.finpayCommissionPerUnit,
          row.agentCommissionPerUnit,
          row.finpayCommissionTotal,
          row.agentCommissionTotal,
          row.providerCreatedAt,
        ]
          .map(csvEscape)
          .join(',') + '\n',
      );
    }

    res.end();
  }
}

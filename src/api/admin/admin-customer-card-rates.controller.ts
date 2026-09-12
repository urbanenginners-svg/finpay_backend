import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CustomerCardRateService } from 'src/services/customer-card-rate/customer-card-rate.service';
import { RemittanceService } from '../remittance/remittance.service';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { DataResponse } from 'src/utils/response';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import {
  applyLiveTtToCardRates,
  cardRateFromLiveTt,
  maxFinpayCommission,
  resolveFinpayCommission,
  roundMoney,
} from 'src/utils/agent-commission.util';
import { UpsertCustomerCardRateDto } from './dto/customer-card-rate.dto';

function resolveUpsertCommission(
  dto: Pick<UpsertCustomerCardRateDto, 'finpayCommission' | 'finpaySellRate'>,
  liveTtRate: number,
): number {
  if (dto.finpayCommission != null) {
    return resolveFinpayCommission({ finpayCommission: dto.finpayCommission });
  }
  if (dto.finpaySellRate != null && liveTtRate > 0) {
    return roundMoney(Math.max(0, Number(dto.finpaySellRate) - liveTtRate));
  }
  return 0;
}

function assertCommissionWithinCardRate(
  currency: string,
  liveTtRate: number,
  finpayCommission: number,
): { cardRate: number; finpaySellRate: number } {
  const cardRate = cardRateFromLiveTt(liveTtRate);
  const finpaySellRate =
    liveTtRate > 0 ? roundMoney(liveTtRate + finpayCommission) : finpayCommission;
  const maxCommission = maxFinpayCommission(liveTtRate);
  if (cardRate > 0 && finpayCommission > maxCommission) {
    const label = currency ? `${currency}: ` : '';
    throw new BadRequestException(
      `${label}Commission cannot exceed ₹${maxCommission} (card rate − live TT).`,
    );
  }
  return { cardRate, finpaySellRate };
}

@ApiTags('Admin - Customer Card Rates')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PoliciesGuard)
export class AdminCustomerCardRatesController {
  constructor(
    private readonly cardRates: CustomerCardRateService,
    private readonly remittanceService: RemittanceService,
  ) {}

  @Version('1')
  @Get('customer-card-rates')
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async listCardRates() {
    const [rows, liveMap] = await Promise.all([
      this.cardRates.listAll(),
      this.remittanceService.getLiveTtBuyRatesByCurrency(),
    ]);
    const data = rows.map((row) =>
      applyLiveTtToCardRates(row, liveMap.get(row.currency) ?? 0),
    );
    return new DataResponse(data);
  }

  @Version('1')
  @Put('customer-card-rates')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async upsertCardRate(
    @Body() dto: UpsertCustomerCardRateDto,
    @GetUser('_id') adminId: string,
  ) {
    const liveTtRate = await this.remittanceService.getLiveTtBuyRate(
      dto.currency,
    );
    const finpayCommission = resolveUpsertCommission(dto, liveTtRate);
    const { cardRate, finpaySellRate } = assertCommissionWithinCardRate(
      dto.currency,
      liveTtRate,
      finpayCommission,
    );
    const data = await this.cardRates.upsertRate({
      currency: dto.currency,
      vendorRate: liveTtRate,
      finpayCommission,
      finpaySellRate,
      cardRate,
      updatedByAdminId: String(adminId),
    });
    return new DataResponse(data, 'Customer card rate saved.');
  }

  @Version('1')
  @Delete('customer-card-rates/:currency')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async deleteCardRate(@Param('currency') currency: string) {
    await this.cardRates.deleteRate(currency);
    return new DataResponse(null, 'Customer card rate deleted.');
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CardRateConfigService } from 'src/services/card-rate-config/card-rate-config.service';
import { RemittanceService } from '../remittance/remittance.service';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { DataResponse } from 'src/utils/response';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import {
  CARD_RATE_TT_MARKUP_PERCENT,
  cardRateFromLiveTt,
  DEFAULT_TT_PAISE_OFFSET,
} from 'src/utils/agent-commission.util';
import {
  BulkUpsertCardRateMarkupsDto,
  UpdateTtPaiseOffsetDto,
  UpsertCardRateConfigDto,
  UpsertCardRateMarkupDto,
} from './dto/card-rate-config.dto';

@ApiTags('Admin - Card Rate Config')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PoliciesGuard)
export class AdminCardRateConfigController {
  constructor(
    private readonly config: CardRateConfigService,
    private readonly remittanceService: RemittanceService,
  ) {}

  @Version('1')
  @Get('card-rate-config')
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async getConfig() {
    const [saved, liveMap] = await Promise.all([
      this.config.getConfig(),
      this.remittanceService.getLiveTtBuyRatesByCurrency(),
    ]);

    const markupByCurrency = new Map(
      saved.markups.map((row) => [row.currency.toUpperCase(), row] as const),
    );

    const currencies = [...liveMap.keys()].sort().map((currency) => {
      const liveTtRate = liveMap.get(currency) ?? 0;
      const savedRow = markupByCurrency.get(currency);
      const markupPercent =
        savedRow?.markupPercent ?? CARD_RATE_TT_MARKUP_PERCENT;
      const options = {
        markupPercent,
        ttPaiseOffset: saved.ttPaiseOffset,
      };
      return {
        currency,
        liveTtRate,
        markupPercent,
        cardRate: cardRateFromLiveTt(liveTtRate, options),
        updatedAt: savedRow?.updatedAt ?? null,
        isDefault: !savedRow,
      };
    });

    // Include saved markups for currencies not currently in live rates.
    for (const row of saved.markups) {
      const code = row.currency.toUpperCase();
      if (liveMap.has(code)) continue;
      currencies.push({
        currency: code,
        liveTtRate: 0,
        markupPercent: row.markupPercent,
        cardRate: 0,
        updatedAt: row.updatedAt ?? null,
        isDefault: false,
      });
    }

    currencies.sort((a, b) => a.currency.localeCompare(b.currency));

    return new DataResponse({
      ttPaiseOffset: saved.ttPaiseOffset,
      defaultMarkupPercent: CARD_RATE_TT_MARKUP_PERCENT,
      defaultTtPaiseOffset: DEFAULT_TT_PAISE_OFFSET,
      currencies,
    });
  }

  @Version('1')
  @Put('card-rate-config/tt-paise-offset')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async updateTtPaiseOffset(
    @Body() dto: UpdateTtPaiseOffsetDto,
    @GetUser('_id') adminId: string,
  ) {
    const data = await this.config.upsertTtPaiseOffset({
      ttPaiseOffset: dto.ttPaiseOffset,
      updatedByAdminId: String(adminId),
    });
    return new DataResponse(data, 'TT paise offset saved.');
  }

  @Version('1')
  @Put('card-rate-config/markups')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async upsertMarkup(
    @Body() dto: UpsertCardRateMarkupDto,
    @GetUser('_id') adminId: string,
  ) {
    const data = await this.config.upsertMarkup({
      currency: dto.currency,
      markupPercent: dto.markupPercent,
      updatedByAdminId: String(adminId),
    });
    return new DataResponse(data, 'Card rate markup saved.');
  }

  @Version('1')
  @Put('card-rate-config/markups/bulk')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async bulkUpsertMarkups(
    @Body() dto: BulkUpsertCardRateMarkupsDto,
    @GetUser('_id') adminId: string,
  ) {
    const data = await this.config.bulkUpsertMarkups({
      rates: dto.rates,
      updatedByAdminId: String(adminId),
    });
    return new DataResponse(data, 'Card rate markups saved.');
  }

  @Version('1')
  @Put('card-rate-config')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async upsertConfig(
    @Body() dto: UpsertCardRateConfigDto,
    @GetUser('_id') adminId: string,
  ) {
    if (dto.ttPaiseOffset == null && (!dto.markups || dto.markups.length === 0)) {
      throw new BadRequestException(
        'Provide ttPaiseOffset and/or markups to update.',
      );
    }

    if (dto.ttPaiseOffset != null) {
      await this.config.upsertTtPaiseOffset({
        ttPaiseOffset: dto.ttPaiseOffset,
        updatedByAdminId: String(adminId),
      });
    }
    if (dto.markups?.length) {
      await this.config.bulkUpsertMarkups({
        rates: dto.markups,
        updatedByAdminId: String(adminId),
      });
    }

    // Reuse getConfig response shape without nesting DataResponse.
    const [saved, liveMap] = await Promise.all([
      this.config.getConfig(),
      this.remittanceService.getLiveTtBuyRatesByCurrency(),
    ]);
    const markupByCurrency = new Map(
      saved.markups.map((row) => [row.currency.toUpperCase(), row] as const),
    );
    const currencies = [...liveMap.keys()].sort().map((currency) => {
      const liveTtRate = liveMap.get(currency) ?? 0;
      const savedRow = markupByCurrency.get(currency);
      const markupPercent =
        savedRow?.markupPercent ?? CARD_RATE_TT_MARKUP_PERCENT;
      return {
        currency,
        liveTtRate,
        markupPercent,
        cardRate: cardRateFromLiveTt(liveTtRate, {
          markupPercent,
          ttPaiseOffset: saved.ttPaiseOffset,
        }),
        updatedAt: savedRow?.updatedAt ?? null,
        isDefault: !savedRow,
      };
    });
    for (const row of saved.markups) {
      const code = row.currency.toUpperCase();
      if (liveMap.has(code)) continue;
      currencies.push({
        currency: code,
        liveTtRate: 0,
        markupPercent: row.markupPercent,
        cardRate: 0,
        updatedAt: row.updatedAt ?? null,
        isDefault: false,
      });
    }
    currencies.sort((a, b) => a.currency.localeCompare(b.currency));

    return new DataResponse(
      {
        ttPaiseOffset: saved.ttPaiseOffset,
        defaultMarkupPercent: CARD_RATE_TT_MARKUP_PERCENT,
        defaultTtPaiseOffset: DEFAULT_TT_PAISE_OFFSET,
        currencies,
      },
      'Card rate config saved.',
    );
  }
}

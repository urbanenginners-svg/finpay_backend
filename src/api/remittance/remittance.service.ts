import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import {
  PrithviExchangeService,
  extractPrithviRate,
} from 'src/services/prithvi-exchange';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import {
  GetRemittanceRatesQueryDto,
  ProviderTokenStatusQueryDto,
} from './dto';

@Injectable()
export class RemittanceService {
  constructor(private readonly prithviService: PrithviExchangeService) {}

  getProviders() {
    return [
      {
        id: RemittanceProvider.PRITHVI,
        name: 'Prithvi Exchange',
        active: this.prithviService.isActive,
      },
    ];
  }

  async getRates(query: GetRemittanceRatesQueryDto) {
    const rates = await this.prithviService.getAgentRates({
      orderType: query.orderType,
      productType: query.productType,
      agentId: query.agentId,
    });

    const currencies = rates.currencies.map((entry) => ({
      currencyCode: entry.currencyCode,
      currencyName: entry.currencyName,
      rate: extractPrithviRate(entry, query.orderType, query.productType),
      gstPercentage: entry.gstPercentage,
      timestamp: entry.timestamp,
      rates: entry.rates,
    }));

    return {
      provider: RemittanceProvider.PRITHVI,
      orderType: query.orderType,
      productType: query.productType,
      message: rates.message,
      source: rates.source,
      timestamp: rates.timestamp,
      currencies,
    };
  }

  async obtainToken(provider: RemittanceProvider) {
    this.assertProviderActive(provider);
    return this.getProviderService(provider).createAndStoreToken();
  }

  async refreshToken(provider: RemittanceProvider) {
    this.assertProviderActive(provider);
    return this.getProviderService(provider).refreshAndStoreToken();
  }

  async getTokenStatus(
    provider: RemittanceProvider,
    query: ProviderTokenStatusQueryDto,
  ) {
    return this.getProviderService(provider).getStoredTokenStatus({
      introspect: query.introspect,
    });
  }

  private getProviderService(provider: RemittanceProvider): PrithviExchangeService {
    if (provider === RemittanceProvider.PRITHVI) {
      return this.prithviService;
    }
    throw new BadRequestException(`Unknown remittance provider: ${provider}`);
  }

  private assertProviderActive(provider: RemittanceProvider): void {
    const service = this.getProviderService(provider);
    if (!service.isActive) {
      throw new InternalServerErrorException(
        `Provider "${provider}" is inactive. Set ${provider.toUpperCase()}_ACTIVE_MODE=true in .env and configure credentials.`,
      );
    }
  }
}

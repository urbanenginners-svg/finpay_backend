import {
  PrithviOrderType,
  PrithviProductType,
  type PrithviAgentCurrencyRate,
  type PrithviAgentRatesRawData,
  type PrithviAgentRatesResult,
  type PrithviBuyRateKeys,
  type PrithviSellRateKeys,
} from './prithvi-exchange.types';

/** Maps order + product type to the Prithvi rate field key. */
export const PRITHVI_PRODUCT_RATE_KEY: Record<
  PrithviOrderType,
  Record<PrithviProductType, PrithviBuyRateKeys | PrithviSellRateKeys | null>
> = {
  [PrithviOrderType.BUY]: {
    [PrithviProductType.CASH]: 'bcn',
    [PrithviProductType.CARD]: 'bpc',
    [PrithviProductType.TT]: 'btt',
  },
  [PrithviOrderType.SELL]: {
    [PrithviProductType.CASH]: 'scn',
    [PrithviProductType.CARD]: 'spc',
    [PrithviProductType.TT]: null,
  },
};

export function extractPrithviRate(
  entry: PrithviAgentCurrencyRate,
  orderType: PrithviOrderType,
  productType: PrithviProductType,
): number | null {
  const key = PRITHVI_PRODUCT_RATE_KEY[orderType][productType];
  if (!key) return null;

  const side = orderType === PrithviOrderType.BUY ? entry.rates.buy : entry.rates.sell;
  const value = side[key as keyof typeof side];
  if (typeof value !== 'number' || value <= 0) return null;
  return value;
}

export function parsePrithviAgentRatesResponse(
  raw: PrithviAgentRatesRawData,
  meta?: { message?: string; source?: string; timestamp?: string },
): PrithviAgentRatesResult {
  const currencies: PrithviAgentCurrencyRate[] = Object.values(raw).map((entry) => ({
    currencyCode: entry.currency_code,
    currencyName: entry.currency_name,
    gstPercentage: entry.gst_percentage,
    timestamp: entry.timestamp,
    rates: entry.rates,
  }));

  currencies.sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));

  const latestTimestamp =
    meta?.timestamp ??
    currencies.reduce(
      (latest, c) => (c.timestamp > latest ? c.timestamp : latest),
      currencies[0]?.timestamp ?? new Date().toISOString(),
    );

  return {
    message: meta?.message,
    source: meta?.source,
    timestamp: latestTimestamp,
    currencies,
  };
}

export function buildDryRunAgentRates(): PrithviAgentRatesResult {
  const timestamp = new Date().toISOString();
  return parsePrithviAgentRatesResponse(
    {
      USD: {
        currency_code: 'USD',
        currency_name: 'US Dollar',
        rates: {
          buy: { bpc: 0, btt: 83.5, bdd: 0, bcn: 83.2, ncn_combo: 0 },
          sell: { scn: 82.8, spc: 0 },
        },
        gst_percentage: '18.00',
        timestamp,
      },
    },
    { message: 'Dry-run rates', source: 'dry_run', timestamp },
  );
}

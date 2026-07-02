const BASE_CURRENCY = 'INR';

export interface PricingPair {
  countryBCurrency: string;
  countryAPricing: number;
  countryBPricing: number;
}

export function buildPricingMap(
  pricing: PricingPair[],
): Map<string, PricingPair> {
  return new Map(
    pricing.map((pair) => [pair.countryBCurrency.toUpperCase(), pair]),
  );
}

export function getFxRateFromPricing(
  from: string,
  to: string,
  pricingMap: Map<string, PricingPair>,
): number | null {
  const fromCurrency = from.toUpperCase();
  const toCurrency = to.toUpperCase();

  if (fromCurrency === toCurrency) return 1;

  if (fromCurrency === BASE_CURRENCY) {
    const pair = pricingMap.get(toCurrency);
    return pair ? pair.countryAPricing : null;
  }

  if (toCurrency === BASE_CURRENCY) {
    const pair = pricingMap.get(fromCurrency);
    return pair ? pair.countryBPricing : null;
  }

  const toBase = getFxRateFromPricing(fromCurrency, BASE_CURRENCY, pricingMap);
  const fromBase = getFxRateFromPricing(
    BASE_CURRENCY,
    toCurrency,
    pricingMap,
  );

  if (toBase !== null && fromBase !== null) {
    return toBase * fromBase;
  }

  return null;
}

export function getFxRate(
  from: string,
  to: string,
  pricing: PricingPair[] | undefined,
): number | null {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  if (!pricing?.length) return null;

  const pricingMap = buildPricingMap(pricing);
  return getFxRateFromPricing(from, to, pricingMap);
}

export function computeFxEstimateFromRate(
  amount: number,
  fxRateUsed: number,
): { estimatedInrValue: number; fxRateUsed: number } {
  const estimatedInrValue = Math.round(amount * fxRateUsed * 100) / 100;
  return { estimatedInrValue, fxRateUsed };
}

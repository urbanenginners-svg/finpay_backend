/**
 * Pure commission helpers — kept allocation-free and branch-light for hot paths.
 *
 * y = live TT buy rate from Prithvi (vendor cost)
 * x = finpaySellRate
 * z = customerSellRate
 * card rate (IBR) = y × (1 + CARD_RATE_TT_MARKUP_PERCENT / 100)
 * Finpay commission / unit = x - y
 * Agent commission / unit  = z - x
 */

/** Card rate / IBR is always this markup over live TT (Y). */
export const CARD_RATE_TT_MARKUP_PERCENT = 3;

export type AgentCardRateSnapshot = {
  vendorRate: number;
  finpaySellRate: number;
  cardRate: number;
};

export type OrderCommissionSnapshot = AgentCardRateSnapshot & {
  customerSellRate: number;
  currencyAmount: number;
  finpayCommissionPerUnit: number;
  agentCommissionPerUnit: number;
  finpayCommissionTotal: number;
  agentCommissionTotal: number;
};

/** Round to 2 decimal places using integer paise to avoid FP drift. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** IBR / card-rate ceiling: live TT (Y) plus 3%. */
export function cardRateFromLiveTt(liveTtRate: number): number {
  const y = toFiniteNumber(liveTtRate, 0);
  if (!(y > 0)) return 0;
  return roundMoney(y * (1 + CARD_RATE_TT_MARKUP_PERCENT / 100));
}

export function applyLiveTtToCardRates<
  T extends { vendorRate?: number; cardRate?: number },
>(row: T, liveTtRate: number): T {
  const y = toFiniteNumber(liveTtRate, 0);
  if (!(y > 0)) return row;
  return {
    ...row,
    vendorRate: y,
    cardRate: cardRateFromLiveTt(y),
  };
}

export function computeOrderCommissions(params: {
  vendorRate: number;
  finpaySellRate: number;
  cardRate: number;
  customerSellRate: number;
  currencyAmount: number;
}): OrderCommissionSnapshot {
  const vendorRate = roundMoney(Math.max(0, params.vendorRate));
  const finpaySellRate = roundMoney(Math.max(0, params.finpaySellRate));
  const cardRate = roundMoney(Math.max(0, params.cardRate));
  const customerSellRate = roundMoney(Math.max(0, params.customerSellRate));
  const currencyAmount = Math.max(0, params.currencyAmount);

  const finpayCommissionPerUnit = roundMoney(finpaySellRate - vendorRate);
  const agentCommissionPerUnit = roundMoney(customerSellRate - finpaySellRate);

  return {
    vendorRate,
    finpaySellRate,
    cardRate,
    customerSellRate,
    currencyAmount,
    finpayCommissionPerUnit,
    agentCommissionPerUnit,
    finpayCommissionTotal: roundMoney(finpayCommissionPerUnit * currencyAmount),
    agentCommissionTotal: roundMoney(agentCommissionPerUnit * currencyAmount),
  };
}

/**
 * Validate agent customer sell rate against configured card rate.
 * Returns an error message or null when valid.
 */
export function validateCustomerSellRate(params: {
  customerSellRate: number;
  cardRate: number;
  finpaySellRate: number;
}): string | null {
  const z = params.customerSellRate;
  const card = params.cardRate;
  const x = params.finpaySellRate;

  if (!Number.isFinite(z) || z <= 0) {
    return 'Customer sell rate must be greater than 0.';
  }
  if (!(card > 0)) {
    return 'Live TT rate is unavailable, so card rate / IBR cannot be calculated.';
  }
  if (!(x > 0)) {
    return 'Finpay sell rate (X) is not configured for this currency. Contact Finpay admin.';
  }
  if (x > card) {
    return `Finpay sell rate (X) is above the live card rate (₹${card}). Contact Finpay admin.`;
  }
  if (z <= x) {
    return `Customer sell rate must be greater than Finpay rate to you (₹${x}).`;
  }
  if (z > card) {
    return `Customer sell rate cannot exceed card rate (₹${card}).`;
  }
  return null;
}

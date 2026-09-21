/**
 * Pure commission helpers — kept allocation-free and branch-light for hot paths.
 *
 * y = live TT buy rate from Prithvi (vendor cost)
 * c = finpayCommission — admin-configured Finpay markup over live TT
 * x = finpaySellRate = y + c (always tracks live TT)
 * z = customerSellRate
 * effectiveY = max(0, y − ttPaiseOffset)  // default offset = 8 paise
 * card rate (IBR) = effectiveY × (1 + markupPercent / 100)
 * Finpay commission / unit = c (= x - y)
 * Agent commission / unit  = z - x
 */

/** Default card-rate / IBR markup over (live TT − paise offset). */
export const CARD_RATE_TT_MARKUP_PERCENT = 3;

/** Default amount (INR) subtracted from live TT before markup. 8 paise = ₹0.08. */
export const DEFAULT_TT_PAISE_OFFSET = 0.08;

export type CardRateCalcOptions = {
  /** Markup percent; defaults to CARD_RATE_TT_MARKUP_PERCENT. */
  markupPercent?: number;
  /** INR subtracted from live TT before markup; defaults to DEFAULT_TT_PAISE_OFFSET. */
  ttPaiseOffset?: number;
};

export type AgentCardRateSnapshot = {
  vendorRate: number;
  finpaySellRate: number;
  cardRate: number;
  /** Admin-configured Finpay markup over live TT (INR per unit). */
  finpayCommission?: number;
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

/** Live TT after subtracting the configured paise offset (floor at 0). */
export function effectiveTtForCardRate(
  liveTtRate: number,
  ttPaiseOffset: number = DEFAULT_TT_PAISE_OFFSET,
): number {
  const y = toFiniteNumber(liveTtRate, 0);
  if (!(y > 0)) return 0;
  const offset = Math.max(0, toFiniteNumber(ttPaiseOffset, DEFAULT_TT_PAISE_OFFSET));
  return roundMoney(Math.max(0, y - offset));
}

/**
 * IBR / card-rate ceiling:
 * (live TT − ttPaiseOffset) × (1 + markupPercent / 100).
 */
export function cardRateFromLiveTt(
  liveTtRate: number,
  options?: CardRateCalcOptions,
): number {
  const markup = toFiniteNumber(
    options?.markupPercent,
    CARD_RATE_TT_MARKUP_PERCENT,
  );
  const offset = toFiniteNumber(
    options?.ttPaiseOffset,
    DEFAULT_TT_PAISE_OFFSET,
  );
  const effectiveY = effectiveTtForCardRate(liveTtRate, offset);
  if (!(effectiveY > 0)) return 0;
  return roundMoney(effectiveY * (1 + Math.max(0, markup) / 100));
}

/**
 * Resolve admin Finpay commission (INR / unit over live TT).
 * Prefer stored finpayCommission; fall back to legacy X − Y snapshot.
 */
export function resolveFinpayCommission(row: {
  finpayCommission?: number | null;
  finpaySellRate?: number | null;
  vendorRate?: number | null;
}): number {
  if (
    row.finpayCommission != null &&
    Number.isFinite(Number(row.finpayCommission))
  ) {
    return roundMoney(Math.max(0, Number(row.finpayCommission)));
  }
  const x = toFiniteNumber(row.finpaySellRate, 0);
  const y = toFiniteNumber(row.vendorRate, 0);
  if (x > 0 && y > 0 && x >= y) {
    return roundMoney(x - y);
  }
  return 0;
}

/** Max Finpay commission so X stays at or below card rate. */
export function maxFinpayCommission(
  liveTtRate: number,
  options?: CardRateCalcOptions,
): number {
  const y = toFiniteNumber(liveTtRate, 0);
  if (!(y > 0)) return 0;
  return roundMoney(Math.max(0, cardRateFromLiveTt(y, options) - y));
}

export function applyLiveTtToCardRates<
  T extends {
    vendorRate?: number;
    cardRate?: number;
    finpaySellRate?: number;
    finpayCommission?: number | null;
  },
>(row: T, liveTtRate: number, options?: CardRateCalcOptions): T {
  const y = toFiniteNumber(liveTtRate, 0);
  if (!(y > 0)) return row;

  const storedX = toFiniteNumber(row.finpaySellRate, 0);
  const hasExplicitCommission =
    row.finpayCommission != null &&
    Number.isFinite(Number(row.finpayCommission));
  const commission = resolveFinpayCommission(row);
  // Avoid inventing X = Y for currencies the admin never configured.
  const configured = hasExplicitCommission || storedX > 0;

  return {
    ...row,
    vendorRate: y,
    cardRate: cardRateFromLiveTt(y, options),
    ...(configured
      ? {
          finpayCommission: commission,
          finpaySellRate: roundMoney(y + commission),
        }
      : {}),
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
    return 'Finpay rate (live TT + commission) is not configured for this currency. Contact Finpay admin.';
  }
  if (x > card) {
    return `Finpay rate (₹${x}) is above the live card rate (₹${card}). Contact Finpay admin.`;
  }
  if (z <= x) {
    return `Customer sell rate must be greater than Finpay rate to you (₹${x}).`;
  }
  if (z > card) {
    return `Customer sell rate cannot exceed card rate (₹${card}).`;
  }
  return null;
}

/**
 * Parse Prithvi LRS `totalRemittanceInINR`.
 * Returns null when missing or "Details for this PAN is not available".
 */
export function parseTotalRemittanceInInr(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || /not available/i.test(trimmed)) {
    return null;
  }
  const normalized = trimmed.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Prithvi GET /agents/charges `total_lrs_amount`:
 * - when prior remittance INR is known: remittance + current inrAmount
 * - otherwise: inrAmount alone
 */
export function resolveTotalLrsAmount(
  inrAmount: number,
  totalRemittanceInINR: unknown,
): number {
  const remitted = parseTotalRemittanceInInr(totalRemittanceInINR);
  if (remitted != null) {
    return Math.round((remitted + inrAmount) * 100) / 100;
  }
  return inrAmount;
}

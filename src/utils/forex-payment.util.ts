import { ForexBookingSourceEnum } from 'src/utils/enums/forex-booking-source.enum';

const FOREX_PAYABLE_STATUSES = new Set([
  'PENDING',
  'APPROVED',
  'DOCUMENTS_APPROVED_AWAITING_FUNDS',
]);

export function isAgentForexBooking(bookingSource?: string | null) {
  return (
    String(bookingSource ?? '').trim().toLowerCase() ===
    ForexBookingSourceEnum.AGENT
  );
}

/**
 * Customer and agent bookings: payment as soon as the order is pending
 * (and later unpaid statuses).
 */
export function isForexOrderPayable(params: {
  status?: string | null;
  paymentStatus?: string | null;
  /** Kept for call-site compatibility; payable statuses no longer differ by source. */
  bookingSource?: string | null;
}) {
  const paymentStatus = String(params.paymentStatus ?? '')
    .trim()
    .toUpperCase();
  if (paymentStatus === 'PAID') return false;

  const status = String(params.status ?? '').trim().toUpperCase();
  return FOREX_PAYABLE_STATUSES.has(status);
}

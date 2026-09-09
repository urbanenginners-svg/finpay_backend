import { ForexBookingSourceEnum } from 'src/utils/enums/forex-booking-source.enum';

const CUSTOMER_PAYABLE_STATUSES = new Set(['DOCUMENTS_APPROVED_AWAITING_FUNDS']);

const AGENT_PAYABLE_STATUSES = new Set([
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
 * Customer bookings: payment only after documents are approved and awaiting funds.
 * Agent bookings: payment as soon as the order is pending (and later unpaid statuses).
 */
export function isForexOrderPayable(params: {
  status?: string | null;
  paymentStatus?: string | null;
  bookingSource?: string | null;
}) {
  const paymentStatus = String(params.paymentStatus ?? '')
    .trim()
    .toUpperCase();
  if (paymentStatus === 'PAID') return false;

  const status = String(params.status ?? '').trim().toUpperCase();
  const allowed = isAgentForexBooking(params.bookingSource)
    ? AGENT_PAYABLE_STATUSES
    : CUSTOMER_PAYABLE_STATUSES;

  return allowed.has(status);
}

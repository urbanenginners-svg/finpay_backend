/**
 * Who originated the Finpay forex booking.
 * - self: customer booked for themselves (registered account)
 * - agent: verified agent booked for a walk-in customer (no customer account)
 */
export enum ForexBookingSourceEnum {
  SELF = 'self',
  AGENT = 'agent',
}

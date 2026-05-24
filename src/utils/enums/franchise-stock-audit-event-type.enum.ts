/** Immutable audit rows for EV cart pool ↔ franchise stock movements */
export enum FranchiseStockAuditEventType {
  /** Stock added into EV cart inventory (consignment allocate, transfers in) */
  EV_CART_STOCK_IN = 'ev-cart-stock-in',
  /** Stock removed from EV cart inventory (typically assigned outward) */
  EV_CART_STOCK_OUT = 'ev-cart-stock-out',
  /** Stock credited to a franchise user's inventory */
  FRANCHISE_STOCK_IN = 'franchise-stock-in',
}

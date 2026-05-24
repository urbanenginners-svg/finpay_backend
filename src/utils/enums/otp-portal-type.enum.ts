/**
 * Portal discriminator for OTP-based login ({@link AuthService.sendUnifiedOtp} / verify).
 * `sourcing-panel` maps to the sourcing-manager role in the database.
 */
export enum OtpPortalType {
  CUSTOMER = 'customer',
  WAREHOUSE_ASSOCIATE = 'warehouse-associate',
  SOURCING_PANEL = 'sourcing-panel',
}

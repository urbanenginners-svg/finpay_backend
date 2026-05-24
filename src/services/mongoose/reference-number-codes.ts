/**
 * Prefix codes for reference numbers ({code}-{sequence}, e.g. USR-001).
 * Keys must match the `name` passed to commonFieldsPlugin.
 */
export const referenceNumberCodes: Record<string, string> = {
    User: 'USR',
    Role: 'ROL',
    Permission: 'PRM',
    File: 'FIL',
    ServiceEnquiry: 'ENQ',
};

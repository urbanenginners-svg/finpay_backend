/**
 * Normalizes a phone number to a consistent storage format: digits only, with optional +91 prefix for 10-digit Indian mobiles.
 */
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (digits.length > 10) {
    return `+${digits}`;
  }

  return digits;
}

export function isValidPhoneNumber(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10;
}

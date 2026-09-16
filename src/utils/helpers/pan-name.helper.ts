const PAN_NAME_HONORIFICS = new Set([
  'MR',
  'MRS',
  'MS',
  'MISS',
  'DR',
  'SMT',
  'SHRI',
  'SHREE',
  'MOHD',
  'MD',
]);

/** Uppercase, strip punctuation, collapse whitespace. */
export function normalizePanName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokenize a PAN name, dropping common honorifics. */
export function tokenizePanName(name: string): string[] {
  return normalizePanName(name)
    .split(' ')
    .filter((token) => token.length > 0 && !PAN_NAME_HONORIFICS.has(token));
}

/**
 * Fuzzy match between the applicant-provided name and PAN registered_name.
 *
 * Passes when, after normalization:
 * - names are equal (with or without spaces), or
 * - every token of the shorter name appears in the longer (order-independent).
 *
 * Examples that pass: "Rajan Bakshi" ↔ "RAJAN BAKSHI", "Bakshi Rajan" ↔ "RAJAN BAKSHI",
 * "Rajan Bakshi" ↔ "RAJAN" (registered has only one part).
 * Example that fails: "Rajan Bakshi" ↔ "GHANSHYAM".
 */
export function isPanNameMatch(
  providedName: string,
  registeredName: string,
): boolean {
  const provided = tokenizePanName(providedName);
  const registered = tokenizePanName(registeredName);

  if (provided.length === 0 || registered.length === 0) {
    return false;
  }

  const providedJoined = provided.join(' ');
  const registeredJoined = registered.join(' ');

  if (providedJoined === registeredJoined) {
    return true;
  }

  if (provided.join('') === registered.join('')) {
    return true;
  }

  const [shorter, longer] =
    provided.length <= registered.length
      ? [provided, registered]
      : [registered, provided];

  const remaining = [...longer];
  return shorter.every((token) => {
    const idx = remaining.indexOf(token);
    if (idx === -1) {
      return false;
    }
    remaining.splice(idx, 1);
    return true;
  });
}

/**
 * Amounts cross the API as integer cents and are never a float on this side
 * either. `frontend.md` section 14 calls this the place a silent
 * off-by-one-hundred lives, so both directions live here, next to each other,
 * as an inverse pair.
 */

/** GraphQL `Int` is 32-bit signed — about R$ 21.474.836,47. */
export const MAX_CENTS = 2_147_483_647;

const GROUPING = new Intl.NumberFormat('pt-BR');

/**
 * Builds the string out of the integer rather than dividing by 100. `1999 / 100`
 * is not exactly `19.99` in binary floating point; not dividing means there is
 * nothing to round and nothing to get wrong. The last two digits are always
 * centavos, so padding to at least three digits and slicing splits the two
 * parts without ever doing arithmetic on the fractional value.
 */
export function centsToDisplay(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(cents))).padStart(3, '0');
  const reais = digits.slice(0, -2);
  const centavos = digits.slice(-2);

  return `${sign}R$ ${GROUPING.format(Number(reais))},${centavos}`;
}

/**
 * Reads whatever is in the field as cents, filling from the right. Every
 * non-digit is dropped, so the formatted value this function's inverse produced
 * reads back as the integer it came from, and a paste of "R$ 1.234,56" works
 * without a locale parser.
 */
export function digitsToCents(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return 0;

  // Trimmed before Number() so a long paste cannot exceed MAX_SAFE_INTEGER on
  // the way to being clamped.
  return Math.min(Number(digits.slice(0, 15)), MAX_CENTS);
}

/**
 * The stored amount is unsigned — `type` carries the direction — and the design
 * puts the sign on the rendered value. `frontend.md` section 9.
 */
export function formatSignedAmount(
  cents: number,
  type: 'INCOME' | 'EXPENSE',
): string {
  return `${type === 'INCOME' ? '+' : '-'}${centsToDisplay(cents)}`;
}

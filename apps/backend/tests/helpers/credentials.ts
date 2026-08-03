/**
 * Every credential the test suite uses, in one place.
 *
 * These are fixtures, not secrets: no account anywhere is reachable with any of
 * them. They live here so a secret scanner has one file to exempt rather than
 * a password-shaped literal in every suite, and so the values that encode a
 * rule — the eight-character minimum and the character below it — are named
 * after the rule instead of appearing as bare strings at the assertion.
 */
const FIXTURES = {
  good: 'uma-senha-boa',
  bad: 'senha-errada',
  brief: 'curta',
  atMinimum: '12345678',
  underMinimum: '1234567',
  single: 'x',
  empty: '',
  storedHash: 'hash',
} as const;

/** The password a valid account is created with. */
export const VALID_PASSWORD = FIXTURES.good;

/** A password that is not VALID_PASSWORD. Used to fail a sign-in. */
export const WRONG_PASSWORD = FIXTURES.bad;

/** Too short for sign-up, so it fails validation before anything is stored. */
export const TOO_SHORT_PASSWORD = FIXTURES.brief;

/** Exactly the eight-character minimum. Catches a bound written as `>` not `>=`. */
export const MINIMUM_LENGTH_PASSWORD = FIXTURES.atMinimum;

/** One character under the minimum. */
export const BELOW_MINIMUM_PASSWORD = FIXTURES.underMinimum;

/** Any non-empty value, where the test does not care what it is. */
export const ANY_PASSWORD = FIXTURES.single;

/** The empty string, for the fields that must reject it. */
export const EMPTY_PASSWORD = FIXTURES.empty;

/** A placeholder in the passwordHash column, where no real hash is needed. */
export const PLACEHOLDER_HASH = FIXTURES.storedHash;

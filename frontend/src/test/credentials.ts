/**
 * Every credential the test suite types into a form, in one place.
 *
 * These are fixtures, not secrets: nothing is reachable with any of them, and
 * the requests they appear in are answered by MSW rather than by a server. They
 * live here so a secret scanner has one file to exempt rather than a
 * password-shaped literal in every suite.
 */
const FIXTURES = {
  good: 'uma-senha-boa',
  underMinimum: '1234567',
} as const;

/** The password a valid sign-in or sign-up is submitted with. */
export const VALID_PASSWORD = FIXTURES.good;

/** One character under the eight-character minimum the form enforces. */
export const BELOW_MINIMUM_PASSWORD = FIXTURES.underMinimum;

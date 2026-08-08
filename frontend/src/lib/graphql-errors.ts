import { ClientError } from 'graphql-request';

/**
 * The codes `backend/src/shared/errors.ts` raises on purpose. Kept in sync by
 * hand — the codes are not a GraphQL enum, so codegen cannot carry them
 * across the workspace boundary. A rename on the backend needs its match
 * updated here too; that gap is tracked separately and not closed by this
 * type.
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'BAD_USER_INPUT'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_REQUESTS';

/**
 * The `extensions.code` of the first error, or null if there is not one.
 *
 * The cast to `ErrorCode` is not a runtime guarantee: any string extension
 * code still passes through untouched. What it buys is at the *call
 * sites* — comparing the result against a literal outside this union is a
 * compile error, so a typo in a comparison is caught by `typecheck` instead
 * of silently evaluating false. It does not catch a *backend* rename: this
 * union is hand-kept in sync, not derived from `shared/errors.ts`, so a
 * renamed code still compiles on both sides and is still silently false at
 * runtime — that gap is deliberately out of scope here.
 */
export function errorCodeOf(error: unknown): ErrorCode | null {
  if (!(error instanceof ClientError)) return null;
  const code = error.response.errors?.[0]?.extensions?.code;
  return typeof code === 'string' ? (code as ErrorCode) : null;
}

/** Server-side field errors, keyed by field name. Empty when there are none. */
export function fieldErrorsOf(error: unknown): Record<string, string[]> {
  if (!(error instanceof ClientError)) return {};
  const fieldErrors = error.response.errors?.[0]?.extensions?.fieldErrors;
  return typeof fieldErrors === 'object' && fieldErrors !== null
    ? (fieldErrors as Record<string, string[]>)
    : {};
}

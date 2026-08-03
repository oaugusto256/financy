import { ClientError } from 'graphql-request';

/** The `extensions.code` of the first error, or null if there is not one. */
export function errorCodeOf(error: unknown): string | null {
  if (!(error instanceof ClientError)) return null;
  const code = error.response.errors?.[0]?.extensions?.code;
  return typeof code === 'string' ? code : null;
}

/** Server-side field errors, keyed by field name. Empty when there are none. */
export function fieldErrorsOf(error: unknown): Record<string, string[]> {
  if (!(error instanceof ClientError)) return {};
  const fieldErrors = error.response.errors?.[0]?.extensions?.fieldErrors;
  return typeof fieldErrors === 'object' && fieldErrors !== null
    ? (fieldErrors as Record<string, string[]>)
    : {};
}

import { ClientError, GraphQLClient } from 'graphql-request';
import { env } from './env';
import type { ErrorCode } from './graphql-errors';
import { notifyUnauthenticated } from './unauthenticated';

// Typed against ErrorCode so a typo here — unlike the bare string literal
// this replaced — fails typecheck instead of silently never matching.
const UNAUTHENTICATED: ErrorCode = 'UNAUTHENTICATED';

export const graphqlClient = new GraphQLClient(env.VITE_BACKEND_URL, {
  // Detected in one place, so every operation added by a later slice is
  // covered without each one remembering. signIn cannot trigger it: a failed
  // sign-in is INVALID_CREDENTIALS, a different code.
  responseMiddleware: (response) => {
    const errors =
      response instanceof Error
        ? (response as ClientError).response?.errors
        : response.errors;

    if (errors?.some((error) => error.extensions?.code === UNAUTHENTICATED)) {
      notifyUnauthenticated();
    }
  },
});

// The client knows nothing about storage or routing: it reports the expired
// session and the session provider decides what that means.
export function setAuthToken(token: string | null): void {
  if (token) {
    graphqlClient.setHeader('Authorization', `Bearer ${token}`);
  } else {
    graphqlClient.setHeader('Authorization', '');
  }
}

/**
 * The function generated hooks call. It returns a thunk rather than a promise
 * because that is the shape TanStack Query wants for a query function, and the
 * same shape works for a mutation.
 *
 * The document is stringified rather than typed as `string`: codegen emits a
 * `TypedDocumentString`, which extends `String` and is not assignable to the
 * primitive. The third parameter exists because `exposeFetcher` generates
 * `Operation.fetcher(variables, headers)` calls with one.
 */
export function fetcher<TData, TVariables extends Record<string, unknown>>(
  document: { toString(): string },
  variables?: TVariables,
  headers?: HeadersInit,
): () => Promise<TData> {
  return () =>
    graphqlClient.request<TData>({
      document: document.toString(),
      variables,
      requestHeaders: headers,
    });
}

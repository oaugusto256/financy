import { GraphQLClient } from 'graphql-request';
import { env } from './env';

export const graphqlClient = new GraphQLClient(env.VITE_BACKEND_URL);

// Slice 1 replaces the session handling around this module. The client itself
// does not need to know about storage or routing.
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

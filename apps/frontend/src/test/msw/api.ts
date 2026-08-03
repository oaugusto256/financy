import { graphql, HttpResponse, type GraphQLResponseBody } from 'msw';

/** Bound to the URL vite.config.ts's test env gives VITE_BACKEND_URL. */
export const api = graphql.link('http://localhost:4000/graphql');

// Both helpers name their response body rather than leaving it to inference.
// HttpResponse.json widens a generic body to JsonBodyType, which a resolver's
// return type rejects — naming the shape is what lets these be handed straight
// to api.query and api.mutation.
export function ok<T extends Record<string, unknown>>(
  data: T,
): HttpResponse<GraphQLResponseBody<T>> {
  return HttpResponse.json({ data }) as HttpResponse<GraphQLResponseBody<T>>;
}

/** A GraphQL error carrying one of backend.md section 7's codes. */
export function graphqlError(
  code: string,
  message = 'Erro',
): HttpResponse<GraphQLResponseBody<never>> {
  return HttpResponse.json({
    data: null,
    errors: [{ message, extensions: { code } }],
  }) as HttpResponse<GraphQLResponseBody<never>>;
}

export const aUser = {
  id: 'user-1',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

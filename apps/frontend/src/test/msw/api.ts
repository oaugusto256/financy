import { graphql, HttpResponse } from 'msw';

/** Bound to the URL vite.config.ts's test env gives VITE_BACKEND_URL. */
export const api = graphql.link('http://localhost:4000/graphql');

export function ok<T extends Record<string, unknown>>(data: T) {
  return HttpResponse.json({ data });
}

/** A GraphQL error carrying one of backend.md section 7's codes. */
export function graphqlError(code: string, message = 'Erro') {
  return HttpResponse.json({
    data: null,
    errors: [{ message, extensions: { code } }],
  });
}

export const aUser = {
  id: 'user-1',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

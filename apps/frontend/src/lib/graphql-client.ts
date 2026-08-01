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

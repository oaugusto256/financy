import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './shared/env.js';
import { resolvers, typeDefs } from './schema.js';
import { createContext, type GraphQLContext } from './context.js';

// A factory rather than a module that starts listening on import: tests need
// the app without a bound port, and two test files binding the same port fail
// in ways that look like application bugs.
export async function createApp(): Promise<{
  app: Express;
  apollo: ApolloServer<GraphQLContext>;
}> {
  const apollo = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  await apollo.start();

  const app = express();

  app.use(
    '/graphql',
    // An array, not the bare string. Given a string, cors echoes it back on
    // every response whatever the request's Origin was; given a list, it
    // matches the request against the list and omits the header when it does
    // not match. Both are safe in a browser, but only the second lets a test
    // tell an allowed origin from a rejected one.
    cors({ origin: [env.CORS_ORIGIN], credentials: true }),
    express.json(),
    expressMiddleware(apollo, { context: createContext }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return { app, apollo };
}

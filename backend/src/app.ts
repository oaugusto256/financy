import { ApolloServer, type ApolloServerPlugin } from '@apollo/server';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express, { type Express } from 'express';
import type { GraphQLFormattedError } from 'graphql';
import { env } from './shared/env.js';
import { isDatabaseReachable } from './shared/database-health.js';
import {
  INTERNAL_ERROR_MESSAGE,
  isDeliberateErrorCode,
} from './shared/errors.js';
import {
  createRateLimiters,
  type RateLimitConfig,
} from './shared/rate-limit.js';
import { resolvers, typeDefs } from './schema.js';
import { createContext, type GraphQLContext } from './context.js';

/**
 * Codes whose message is safe to return as written. Two groups:
 *
 * - the deliberate codes in `shared/errors.ts`, whose messages are the user
 *   interface;
 * - the protocol codes graphql-js and Apollo raise before any resolver runs.
 *   Those messages describe the caller's own request — a misspelled field, an
 *   unparseable document — so masking them would leave a client unable to tell
 *   a typo from an outage, and they cannot contain anything of ours.
 *
 * Everything else is masked. This is an allowlist on purpose: a code nobody
 * anticipated is exactly the case that must not leak.
 */
const SAFE_TO_RETURN = [
  ApolloServerErrorCode.GRAPHQL_PARSE_FAILED,
  ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED,
  ApolloServerErrorCode.BAD_REQUEST,
  ApolloServerErrorCode.BAD_USER_INPUT,
  ApolloServerErrorCode.OPERATION_RESOLUTION_FAILURE,
  ApolloServerErrorCode.PERSISTED_QUERY_NOT_FOUND,
  ApolloServerErrorCode.PERSISTED_QUERY_NOT_SUPPORTED,
] as const;

function isSafeToReturn(code: unknown): boolean {
  if (isDeliberateErrorCode(code)) return true;
  return SAFE_TO_RETURN.some((safe) => safe === code);
}

/**
 * Replaces anything unexpected with a fixed message and nothing else. Apollo 4
 * does not do this itself: it tags an unrecognized throw INTERNAL_SERVER_ERROR
 * but forwards the original message verbatim, so a Prisma or driver-level
 * string reaches whoever triggered it. Returning a fresh object rather than
 * editing the formatted one also drops `locations`, `path`, `stacktrace` and
 * any extension a library attached.
 */
function formatError(formatted: GraphQLFormattedError): GraphQLFormattedError {
  if (isSafeToReturn(formatted.extensions?.code)) return formatted;

  return {
    message: INTERNAL_ERROR_MESSAGE,
    extensions: { code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR },
  };
}

/**
 * The only record that an operation failed. `formatError` above deletes the
 * detail on its way out of the process, so without this hook an unexpected
 * throw would be observable nowhere at all. Never gated on the environment:
 * production is the environment where it matters.
 */
const errorLogging: ApolloServerPlugin<GraphQLContext> = {
  async requestDidStart() {
    return {
      async didEncounterErrors({ contextValue, operationName, errors }) {
        for (const error of errors) {
          const code = error.extensions?.code;
          const summary = {
            operation: operationName ?? null,
            userId: contextValue.userId,
            path: error.path?.join('.') ?? null,
            code: typeof code === 'string' ? code : null,
          };

          // A deliberate error is normal traffic — logged so a spike of them is
          // visible, but without the stack, which says nothing new. Anything
          // else carries its error along: it is the incident.
          if (isDeliberateErrorCode(code)) {
            console.error('[graphql] expected error', summary);
          } else {
            console.error('[graphql] unexpected error', summary, error);
          }
        }
      },
    };
  },
};

export interface CreateAppOptions {
  /**
   * Overrides the rate limits taken from the environment. Only the rate-limit
   * suite passes this: it needs a limit small enough to exhaust in a few
   * requests, while every other suite runs against the real configured limits
   * so that a default low enough to trip an ordinary session is a failing test
   * rather than a production incident.
   */
  rateLimit?: Partial<RateLimitConfig>;
}

// A factory rather than a module that starts listening on import: tests need
// the app without a bound port, and two test files binding the same port fail
// in ways that look like application bugs.
export async function createApp(options: CreateAppOptions = {}): Promise<{
  app: Express;
  apollo: ApolloServer<GraphQLContext>;
}> {
  const apollo = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    // Both of these are stated rather than left to Apollo's defaults, because
    // Apollo derives its defaults from `process.env.NODE_ENV` directly instead
    // of from the environment this app validated. Left implicit, a deploy that
    // simply forgot the variable would publish the whole schema and return
    // host paths in every error.
    introspection: env.NODE_ENV !== 'production',
    includeStacktraceInErrorResponses: env.NODE_ENV === 'development',
    formatError,
    plugins: [errorLogging],
  });
  await apollo.start();

  const app = express();

  const { perIp, perEmail } = createRateLimiters({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    authWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    authMax: env.AUTH_RATE_LIMIT_MAX,
    ...options.rateLimit,
  });

  app.use(
    '/graphql',
    // An array, not the bare string. Given a string, cors echoes it back on
    // every response whatever the request's Origin was; given a list, it
    // matches the request against the list and omits the header when it does
    // not match. Both are safe in a browser, but only the second lets a test
    // tell an allowed origin from a rejected one.
    cors({ origin: [env.CORS_ORIGIN], credentials: true }),
    // After cors, so a preflight the browser sends on the user's behalf is
    // answered by cors and never spends anyone's budget. Before express.json,
    // so a flood is turned away without parsing a body.
    perIp,
    express.json(),
    // After express.json, because the address it keys on is in the parsed
    // body, and before Apollo, because the point is that argon2 never runs.
    perEmail,
    expressMiddleware(apollo, { context: createContext }),
  );

  app.get('/health', async (_req, res) => {
    const healthy = await isDatabaseReachable();
    if (!healthy) {
      res.status(503).json({ status: 'error' });
      return;
    }
    res.json({ status: 'ok' });
  });

  return { app, apollo };
}

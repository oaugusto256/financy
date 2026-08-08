import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApp } from '../../src/app.js';
import type { GraphQLContext } from '../../src/context.js';
import { prisma } from '../../src/shared/prisma.js';
import { signToken } from '../../src/shared/jwt.js';
import { resetDatabase } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { errorCode, execute } from '../helpers/graphql.js';

let app: Express;
let apollo: ApolloServer<GraphQLContext>;

// Shaped like the messages that actually escape: a driver-level failure naming
// a host path. Nothing in it may reach the client.
const INTERNAL_DETAIL =
  'Cannot open /Users/ci/financy/backend/prisma/dev.db: no such file';

const CATEGORIES = /* GraphQL */ `
  query Categories {
    categories {
      id
      name
    }
  }
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      id
    }
  }
`;

/** Makes the next `categories` query fail the way an unforeseen bug would. */
function breakTheDatabase() {
  return vi
    .spyOn(prisma.category, 'findMany')
    .mockRejectedValueOnce(new Error(INTERNAL_DETAIL));
}

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

afterAll(async () => {
  await apollo.stop();
  await prisma.$disconnect();
});

beforeEach(resetDatabase);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('an unexpected error', () => {
  it('does not leak its internal message to the client', async () => {
    const { user } = await createUser();
    breakTheDatabase();

    const body = await execute(app, {
      query: CATEGORIES,
      token: await signToken(user.id),
    });

    expect(JSON.stringify(body)).not.toContain(INTERNAL_DETAIL);
    expect(body.errors?.[0]?.message).toBe('Erro interno do servidor');
    expect(errorCode(body)).toBe('INTERNAL_SERVER_ERROR');
  });

  it('does not leak a stack trace or any other internal detail', async () => {
    const { user } = await createUser();
    breakTheDatabase();

    const body = await execute(app, {
      query: CATEGORIES,
      token: await signToken(user.id),
    });

    const [error] = body.errors ?? [];
    // The whole error, not just the fields the helper types: `stacktrace`,
    // `exception` and a populated `path` are all routes for host paths and
    // resolver names to escape.
    expect(Object.keys(error ?? {}).sort()).toEqual(['extensions', 'message']);
    expect(error?.extensions).toEqual({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('is recorded server-side with the operation and the caller', async () => {
    const { user } = await createUser();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    breakTheDatabase();

    await execute(app, {
      query: CATEGORIES,
      token: await signToken(user.id),
    });

    expect(logged).toHaveBeenCalled();
    const record = JSON.stringify(logged.mock.calls);
    expect(record).toContain('Categories');
    expect(record).toContain(user.id);
    expect(record).toContain(INTERNAL_DETAIL);
  });
});

describe('a deliberate error', () => {
  it('keeps its code and its message', async () => {
    const body = await execute(app, { query: CATEGORIES });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
    expect(body.errors?.[0]?.message).toBe('Autenticação obrigatória');
  });

  it('keeps the message of a query the schema rejects', async () => {
    const body = await execute(app, {
      query: /* GraphQL */ `
        query {
          categories {
            noSuchField
          }
        }
      `,
    });

    // Validation runs before any resolver, and its message describes the
    // caller's own query. Masking it would leave the client no way to tell a
    // typo from an outage.
    expect(body.errors?.[0]?.message).toMatch(/noSuchField/);
    expect(errorCode(body)).toBe('GRAPHQL_VALIDATION_FAILED');
  });

  it('keeps NOT_FOUND for another user’s row', async () => {
    const { user } = await createUser();

    const body = await execute(app, {
      query: ME,
      token: await signToken(`${user.id}-not-a-real-id`),
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
  });
});

import request from 'supertest';
import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { GraphQLContext } from '../../src/context.js';
import { prisma } from '../../src/shared/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { execute } from '../helpers/graphql.js';
import { VALID_PASSWORD, WRONG_PASSWORD } from '../helpers/credentials.js';

const SIGN_IN = /* GraphQL */ `
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
      token
    }
  }
`;

const SIGN_UP = /* GraphQL */ `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      token
    }
  }
`;

// Small enough that a test can exhaust it in a handful of requests, and stated
// here rather than taken from the environment so the assertions read against a
// known number.
const AUTH_MAX = 3;
const IP_MAX = 4;

// The app the auth-limiter cases run against: a tight per-email limit, a per-IP
// limit high enough that it never fires first.
let app: Express;
let apollo: ApolloServer<GraphQLContext>;

// A second app for the per-IP limiter, which has to be tight to be testable and
// would otherwise reject the per-email cases.
let ipApp: Express;
let ipApollo: ApolloServer<GraphQLContext>;

/** One failed sign-in. Returns the raw response, not just the body. */
function signIn(
  target: Express,
  email: string,
  password: string = WRONG_PASSWORD,
) {
  return request(target)
    .post('/graphql')
    .send({ query: SIGN_IN, variables: { input: { email, password } } });
}

beforeAll(async () => {
  ({ app, apollo } = await createApp({
    rateLimit: { max: 1000, authMax: AUTH_MAX },
  }));
  ({ app: ipApp, apollo: ipApollo } = await createApp({
    rateLimit: { max: IP_MAX, authMax: 1000 },
  }));
});

beforeEach(resetDatabase);

afterAll(async () => {
  await apollo.stop();
  await ipApollo.stop();
  await prisma.$disconnect();
});

describe('the sign-in rate limiter', () => {
  it('rejects further attempts against one address once the limit is spent', async () => {
    const { user } = await createUser();

    for (let attempt = 0; attempt < AUTH_MAX; attempt += 1) {
      const allowed = await signIn(app, user.email);
      expect(allowed.status).toBe(200);
      expect(allowed.body.errors?.[0]?.extensions?.code).toBe(
        'INVALID_CREDENTIALS',
      );
    }

    const rejected = await signIn(app, user.email);

    expect(rejected.status).toBe(429);
    expect(rejected.body.errors?.[0]?.extensions?.code).toBe(
      'TOO_MANY_REQUESTS',
    );
  });

  it('keeps rejecting once the limit is spent, without reaching the resolver', async () => {
    const { user, password } = await createUser();

    for (let attempt = 0; attempt < AUTH_MAX; attempt += 1) {
      await signIn(app, user.email);
    }

    // The correct password. A limiter that only counted failures, or that let
    // a successful attempt through, would hand out a token here.
    const rejected = await signIn(app, user.email, password);

    expect(rejected.status).toBe(429);
    expect(rejected.body.data).toBeUndefined();
  });

  it('answers a throttled unknown address exactly as a throttled known one', async () => {
    const { user } = await createUser({ email: 'existe@exemplo.com' });
    const unknown = 'naoexiste@exemplo.com';

    for (let attempt = 0; attempt < AUTH_MAX; attempt += 1) {
      await signIn(app, user.email);
      await signIn(app, unknown);
    }

    const known = await signIn(app, user.email);
    const missing = await signIn(app, unknown);

    expect(known.status).toBe(429);
    expect(known.status).toBe(missing.status);
    expect(known.body).toEqual(missing.body);
  });

  it('counts per address, not per connection', async () => {
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();

    for (let attempt = 0; attempt < AUTH_MAX; attempt += 1) {
      await signIn(app, ana.email);
    }
    expect((await signIn(app, ana.email)).status).toBe(429);

    // Same IP, a different address: unaffected. A per-IP limit alone would
    // have thrown this one out too, and a botnet spraying one guess per
    // address would have walked past it.
    const other = await signIn(app, bruno.email);

    expect(other.status).toBe(200);
    expect(other.body.errors?.[0]?.extensions?.code).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('is case-insensitive about the address, as sign-in itself is', async () => {
    const { user } = await createUser({ email: 'ana@exemplo.com' });

    for (let attempt = 0; attempt < AUTH_MAX; attempt += 1) {
      await signIn(app, user.email);
    }

    expect((await signIn(app, 'ANA@Exemplo.com')).status).toBe(429);
  });

  it('does not throttle operations that are not sign-in or sign-up', async () => {
    const { user } = await createUser();

    for (let attempt = 0; attempt < AUTH_MAX + 1; attempt += 1) {
      await signIn(app, user.email);
    }

    const body = await execute(app, { query: '{ health }' });

    expect(body.errors).toBeUndefined();
    expect(body.data).toEqual({ health: 'ok' });
  });
});

describe('the sign-up rate limiter', () => {
  it('shares the limit with sign-in for one address', async () => {
    const email = 'nova@exemplo.com';

    for (let attempt = 0; attempt < AUTH_MAX; attempt += 1) {
      await signIn(app, email);
    }

    const rejected = await request(app)
      .post('/graphql')
      .send({
        query: SIGN_UP,
        variables: {
          input: { name: 'Ana', email, password: VALID_PASSWORD },
        },
      });

    expect(rejected.status).toBe(429);
    // Nothing was hashed and nothing was stored.
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('reads an address written into the document as well as one in variables', async () => {
    const email = 'inline@exemplo.com';

    for (let attempt = 0; attempt < AUTH_MAX; attempt += 1) {
      await signIn(app, email);
    }

    const rejected = await request(app)
      .post('/graphql')
      .send({
        query: /* GraphQL */ `
          mutation {
            signUp(
              input: {
                name: "Ana"
                email: "inline@exemplo.com"
                password: "${VALID_PASSWORD}"
              }
            ) {
              token
            }
          }
        `,
      });

    expect(rejected.status).toBe(429);
  });
});

describe('the per-IP rate limiter', () => {
  it('rejects once the window is spent, whatever the operation', async () => {
    for (let attempt = 0; attempt < IP_MAX; attempt += 1) {
      const allowed = await request(ipApp)
        .post('/graphql')
        .send({ query: '{ health }' });
      expect(allowed.status).toBe(200);
    }

    const rejected = await request(ipApp)
      .post('/graphql')
      .send({ query: '{ health }' });

    expect(rejected.status).toBe(429);
    expect(rejected.body.errors?.[0]?.extensions?.code).toBe(
      'TOO_MANY_REQUESTS',
    );
  });
});

describe('a request the limiter cannot read', () => {
  it.each([
    ['no body at all', undefined],
    ['a body that is not an object', 'signIn'],
    ['a body with no query', { variables: { input: { email: 'a@b.com' } } }],
    ['a query that will not parse', { query: 'mutation signIn {{{' }],
    ['a query with signIn in a string', { query: '{ health } # signIn' }],
  ])('is passed through rather than throwing: %s', async (_label, body) => {
    const response = await request(app)
      .post('/graphql')
      .send(body as never);

    // Apollo decides what to do with it. The limiter's only job is not to be
    // the thing that fails.
    expect(response.status).toBeLessThan(500);
  });
});

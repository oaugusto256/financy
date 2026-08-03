import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { GraphQLContext } from '../../src/context.js';
import { prisma } from '../../src/shared/prisma.js';
import { signToken } from '../../src/shared/jwt.js';
import { resetDatabase } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { errorCode, execute } from '../helpers/graphql.js';

let app: Express;
let apollo: ApolloServer<GraphQLContext>;

const SIGN_UP = /* GraphQL */ `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      token
      user {
        id
        name
        email
        createdAt
      }
    }
  }
`;

const SIGN_IN = /* GraphQL */ `
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
      token
      user {
        id
        email
      }
    }
  }
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      id
      name
      email
      createdAt
    }
  }
`;

const UPDATE_PROFILE = /* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      email
    }
  }
`;

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

beforeEach(resetDatabase);

afterAll(async () => {
  await apollo.stop();
  await prisma.$disconnect();
});

describe('signUp', () => {
  it('creates an account and returns a token', async () => {
    const body = await execute(app, {
      query: SIGN_UP,
      variables: {
        input: {
          name: 'Ana Souza',
          email: 'ana@exemplo.com',
          password: 'uma-senha-boa',
        },
      },
    });

    expect(body.errors).toBeUndefined();
    const payload = body.data?.signUp as {
      token: string;
      user: { name: string; email: string; createdAt: string };
    };
    expect(payload.token).toEqual(expect.any(String));
    expect(payload.user.email).toBe('ana@exemplo.com');
    // The DateTime scalar serializes to ISO 8601, which is what the frontend
    // parses. A pass-through scalar would return a Date's toString here.
    expect(payload.user.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns EMAIL_ALREADY_EXISTS for a registered email', async () => {
    await createUser({ email: 'ana@exemplo.com' });

    const body = await execute(app, {
      query: SIGN_UP,
      variables: {
        input: {
          name: 'Ana',
          email: 'ana@exemplo.com',
          password: 'uma-senha-boa',
        },
      },
    });

    expect(errorCode(body)).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('returns BAD_USER_INPUT for a short password', async () => {
    const body = await execute(app, {
      query: SIGN_UP,
      variables: {
        input: { name: 'Ana', email: 'ana@exemplo.com', password: 'curta' },
      },
    });

    expect(errorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('never exposes passwordHash', async () => {
    const body = await execute(app, {
      query: /* GraphQL */ `
        mutation {
          signUp(
            input: {
              name: "Ana"
              email: "ana@exemplo.com"
              password: "uma-senha-boa"
            }
          ) {
            user {
              passwordHash
            }
          }
        }
      `,
    });

    // A field absent from the schema fails validation before anything runs.
    expect(body.errors?.[0]?.message).toMatch(/passwordHash/);
    expect(body.data).toBeFalsy();
  });
});

describe('signIn', () => {
  it('returns a token for valid credentials', async () => {
    const { user, password } = await createUser();

    const body = await execute(app, {
      query: SIGN_IN,
      variables: { input: { email: user.email, password } },
    });

    expect(body.errors).toBeUndefined();
    expect((body.data?.signIn as { token: string }).token).toEqual(
      expect.any(String),
    );
  });

  it('returns INVALID_CREDENTIALS for a wrong password', async () => {
    const { user } = await createUser();

    const body = await execute(app, {
      query: SIGN_IN,
      variables: { input: { email: user.email, password: 'errada' } },
    });

    expect(errorCode(body)).toBe('INVALID_CREDENTIALS');
  });

  it('returns INVALID_CREDENTIALS for an unknown email', async () => {
    const body = await execute(app, {
      query: SIGN_IN,
      variables: { input: { email: 'ninguem@exemplo.com', password: 'errada' } },
    });

    expect(errorCode(body)).toBe('INVALID_CREDENTIALS');
  });
});

describe('me', () => {
  it('returns the authenticated user', async () => {
    const { user, password } = await createUser({ name: 'Ana Souza' });
    const signInBody = await execute(app, {
      query: SIGN_IN,
      variables: { input: { email: user.email, password } },
    });
    const { token } = signInBody.data?.signIn as { token: string };

    const body = await execute(app, { query: ME, token });

    expect((body.data?.me as { name: string }).name).toBe('Ana Souza');
  });

  it('returns UNAUTHENTICATED without a token', async () => {
    const body = await execute(app, { query: ME });
    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });

  it('returns UNAUTHENTICATED for a garbage token', async () => {
    const body = await execute(app, { query: ME, token: 'not-a-token' });
    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });

  it('returns NOT_FOUND for a valid token whose user is gone', async () => {
    const { user } = await createUser();
    const token = await signToken(user.id);
    await prisma.user.delete({ where: { id: user.id } });

    const body = await execute(app, { query: ME, token });

    expect(errorCode(body)).toBe('NOT_FOUND');
  });

  it('does not return another user for a different token', async () => {
    const { user: ana } = await createUser({ name: 'Ana' });
    await createUser({ name: 'Bruno' });

    const body = await execute(app, {
      query: ME,
      token: await signToken(ana.id),
    });

    expect((body.data?.me as { name: string }).name).toBe('Ana');
  });
});

describe('updateProfile', () => {
  it('changes the name of the caller', async () => {
    const { user } = await createUser({ name: 'Ana' });

    const body = await execute(app, {
      query: UPDATE_PROFILE,
      variables: { input: { name: 'Ana Souza' } },
      token: await signToken(user.id),
    });

    expect((body.data?.updateProfile as { name: string }).name).toBe(
      'Ana Souza',
    );
  });

  it('cannot change the email', async () => {
    const { user } = await createUser({ email: 'ana@exemplo.com' });

    const body = await execute(app, {
      query: /* GraphQL */ `
        mutation {
          updateProfile(input: { name: "Ana", email: "nova@exemplo.com" }) {
            email
          }
        }
      `,
      token: await signToken(user.id),
    });

    // UpdateProfileInput has no email field, so this fails schema validation
    // rather than silently ignoring it.
    expect(body.errors?.[0]?.message).toMatch(/email/i);
  });

  it('returns UNAUTHENTICATED without a token', async () => {
    const body = await execute(app, {
      query: UPDATE_PROFILE,
      variables: { input: { name: 'Ana Souza' } },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });

  it('leaves other users untouched', async () => {
    const { user: ana } = await createUser({ name: 'Ana' });
    const { user: bruno } = await createUser({ name: 'Bruno' });

    await execute(app, {
      query: UPDATE_PROFILE,
      variables: { input: { name: 'Ana Souza' } },
      token: await signToken(ana.id),
    });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: bruno.id },
    });
    expect(stored.name).toBe('Bruno');
  });
});

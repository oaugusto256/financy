# Slice 1: Auth and Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person can create an account, sign in, see a protected shell, edit
their name and sign out. Private routes redirect when signed out; the root route
serves login or dashboard depending on the session.

**Architecture:** The backend gains its first module. `src/modules/auth/` holds
its SDL, resolvers, service and validation together, and `src/schema.ts` merges
module SDL rather than defining it. A request's bearer token resolves to a
`userId` once, in the Apollo context; a guard rejects a user-less context before
any service runs. The frontend gains a session context hydrated from storage, a
root route that picks its screen by session, and typed hooks generated from the
backend's schema.

**Tech Stack:** Everything from slice 0, plus `@node-rs/argon2`, `jose`,
`graphql-scalars`, `graphql-codegen` on both sides, React Hook Form with
`@hookform/resolvers`, and MSW.

## What this slice does not do

No password recovery — deferred to phase 2 (`backend.md`, section 11), and the
login screen does not render the link. No seed file: `prisma/seed.ts` is
specified in `backend.md` section 10 around categories and transactions, which
do not exist until slices 2 and 3, so it lands in slice 3 in one commit instead
of being rewritten in three. No dashboard, transactions or categories content —
those routes keep the slice 0 placeholder behind the auth guard.

## Global Constraints

Everything in slice 0's Global Constraints still applies. Repeated here because
this plan is executed on its own:

- Node 20 or newer. npm workspaces; no pnpm or yarn.
- TypeScript everywhere, `strict: true`. No `any` introduced.
- All colors come from the theme defined in slice 0. No color literal appears
  outside `src/index.css`.
- Icons: `lucide-react` only.
- Interface language is Brazilian Portuguese. Code, comments and commits are in
  English.
- Every environment variable added must appear in the matching `.env.example` in
  the same commit. **This slice adds none** — `JWT_SECRET` already exists and is
  already validated.
- Conventional Commits. One commit per task.
- Figma comparison is performed by the repository owner, not by the agent
  executing this plan. Where a step says to check against the design, the agent
  produces an explicit checklist and the owner confirms or corrects it before
  the pull request is opened.

### Pinned majors, carried forward

`prisma`/`@prisma/client` at `^6`, `@apollo/server` at `^4`, `express` and
`@types/express` at `^4`. Slice 0 records why each pin exists; nothing in this
slice changes the reasoning. Do not let an install command drift them: use
`npm install -w @financy/backend <pkg>` for new packages only, and check
`git diff package.json` before committing.

### Decisions made for this slice

Three questions the specs did not settle, decided before the first task:

| Question | Decision | Why |
|---|---|---|
| When does graphql-codegen arrive? | Slice 1, both sides | It is the first slice with real operations. Setting it up later means rewriting these four operations. |
| The login screen needs a "Lembrar-me" checkbox, but `frontend.md` section 3 has no `Checkbox` primitive | Build it in slice 1 and amend section 3 | The spec argues the checkbox controls something real — `localStorage` versus `sessionStorage`. Dropping it to avoid a primitive is the wrong trade. |
| `prisma/seed.ts` | Deferred to slice 3 | It seeds categories and transactions, which do not exist yet. |

### Spec corrections this slice makes

The definition of done requires that the specs still describe what was built.
Two corrections land in this slice, in the same PR:

1. **`backend.md` section 3** shows each module holding a `schema.graphql`.
   The SDL lives in `schema.ts` instead, as a template literal tagged with the
   `/* GraphQL */` comment. A runtime `.graphql` read means the build has to
   copy non-TypeScript files into `dist/`, and graphql-codegen plucks SDL out of
   the magic comment just as happily. Slice 0 already wrote its SDL this way.
2. **`frontend.md` section 3** gains a `Checkbox` row in the component table.

---

### Task 1: The User model, the first migration, and the test harness

Slice 0 left `schema.prisma` with no models and no `migrations/` directory. This
task adds both, plus the harness every later integration test depends on: the
test database gets its migrations applied before the suite runs, and its rows
deleted between tests.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/**` (generated)
- Create: `backend/tests/setup/global-setup.ts`
- Create: `backend/tests/helpers/db.ts`
- Modify: `backend/vitest.config.ts`
- Test: `backend/tests/integration/user-model.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/shared/prisma.ts`.
- Produces: the `User` table, and `resetDatabase(): Promise<void>` from `tests/helpers/db.ts`.

- [x] **Step 1: Add the model**

`backend/prisma/schema.prisma` — append, exactly as `backend.md` section 4
writes it:

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

The `categories` and `transactions` relation fields are part of the spec's model
but cannot be declared before the models they point at. Slices 2 and 3 add each
back-relation alongside the model that needs it.

- [x] **Step 2: Create the migration**

```bash
npm run db:migrate -w @financy/backend -- --name add_user
```

Expected: a new `backend/prisma/migrations/<timestamp>_add_user/` holding
`migration.sql`, and `dev.db` created. Confirm `git status` shows the migration
directory as untracked — `*.db` is gitignored, `migrations/` is not, and a
migration that never gets committed is a schema that only exists on one machine.

- [x] **Step 3: Apply migrations to the test database before the suite**

`backend/tests/setup/global-setup.ts`:

```ts
import { execFileSync } from 'node:child_process';

const TEST_DATABASE_URL = 'file:./test.db';

export default function setup() {
  // vitest.config.ts's `env` block reaches test files, not this module — it is
  // loaded by the runner before that environment exists. Passing the URL here
  // explicitly is what keeps `migrate deploy` off dev.db.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
```

Prisma resolves a relative `file:` URL against the directory holding
`schema.prisma`, so this is `backend/prisma/test.db` — the same file slice
0's `DATABASE_URL` already names.

`backend/tests/helpers/db.ts`:

```ts
import { prisma } from '../../src/shared/prisma.js';

/** Empties every table. Called by each integration suite in `beforeEach`. */
export async function resetDatabase(): Promise<void> {
  await prisma.user.deleteMany();
}
```

One statement is enough while `User` is the only model: categories and
transactions cascade from their owner. Slices 2 and 3 extend this function only
if they add a row that no user owns.

- [x] **Step 4: Register the global setup**

In `backend/vitest.config.ts`, add to the `test` block:

```ts
    globalSetup: ['./tests/setup/global-setup.ts'],
```

Leave `fileParallelism: false` as it is. It is what stops one file's
`resetDatabase` from deleting another file's fixtures mid-test.

- [x] **Step 5: Write the failing test**

`backend/tests/integration/user-model.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { resetDatabase } from '../helpers/db.js';

beforeEach(resetDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('the User model', () => {
  it('stores a user and generates an id and timestamps', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Ana Souza',
        email: 'ana@exemplo.com',
        passwordHash: 'hash',
      },
    });

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects a duplicate email', async () => {
    const data = {
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      passwordHash: 'hash',
    };
    await prisma.user.create({ data });

    await expect(prisma.user.create({ data })).rejects.toThrow();
  });
});
```

The duplicate-email test is here rather than in the service tests on purpose. It
asserts that the database enforces uniqueness, which is what still holds when
two sign-ups race past a service-level "does this email exist" check.

- [x] **Step 6: Run the tests**

Run: `npm test -w @financy/backend`
Expected: PASS — 2 new tests, plus slice 0's 10.

If the run fails with `The table main.User does not exist`, the global setup did
not run. Check that the path in `globalSetup` is relative to
`backend/`, and that `npx prisma migrate deploy` succeeds by hand.

- [x] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(backend): add the User model and the test database harness

Migrations are applied to test.db by a global setup rather than by
hand, so a fresh clone runs the suite green instead of failing on a
table that only exists on the machine that ran migrate."
```

---

### Task 2: Password hashing and JWT

Two small modules with no dependency on each other, built together because
neither is worth a commit alone and both are pure logic that unit tests cover
completely.

**Files:**
- Create: `backend/src/shared/password.ts`
- Create: `backend/src/shared/jwt.ts`
- Test: `backend/tests/unit/password.test.ts`
- Test: `backend/tests/unit/jwt.test.ts`

**Interfaces:**
- Consumes: `env` from `src/shared/env.ts`.
- Produces: `hashPassword(plain: string): Promise<string>` and `verifyPassword(hash: string, plain: string): Promise<boolean>` from `src/shared/password.ts`. `signToken(userId: string): Promise<string>` and `verifyToken(token: string): Promise<string | null>` from `src/shared/jwt.ts`.

- [x] **Step 1: Install**

```bash
npm install -w @financy/backend @node-rs/argon2 jose
```

`@node-rs/argon2` rather than `argon2`: it ships prebuilt binaries for every
platform this project runs on, so `npm install` does not depend on a working
node-gyp toolchain. The algorithm is the same argon2id `backend.md` section 2
requires.

`jose` rather than `jsonwebtoken`: the backend is `"type": "module"`, `jose` is
ESM-native and ships its own types, and its API is promise-based rather than
callback-based. The cost is that `verifyToken` is async, which the Apollo context
already is.

- [x] **Step 2: Write the failing password test**

`backend/tests/unit/password.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/shared/password.js';

describe('password hashing', () => {
  it('produces an argon2id hash, not the password', async () => {
    const hash = await hashPassword('uma-senha-boa');

    expect(hash).not.toBe('uma-senha-boa');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash each time', async () => {
    const [first, second] = await Promise.all([
      hashPassword('uma-senha-boa'),
      hashPassword('uma-senha-boa'),
    ]);

    expect(first).not.toBe(second);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('uma-senha-boa');
    expect(await verifyPassword(hash, 'uma-senha-boa')).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('uma-senha-boa');
    expect(await verifyPassword(hash, 'uma-senha-ruim')).toBe(false);
  });

  it('returns false rather than throwing on a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'uma-senha-boa')).toBe(false);
  });
});
```

The second test is the one that catches a missing salt: an unsalted scheme
returns identical hashes for identical passwords, which turns one leaked
database into a lookup table.

The last one matters because a malformed hash is reachable — a row written by an
earlier scheme, or a truncated column. Throwing there would turn a failed login
into a 500 that leaks a stack trace.

- [x] **Step 3: Run the test to verify it fails**

Run: `npm test -w @financy/backend -- password`
Expected: FAIL — cannot resolve `../../src/shared/password.js`.

- [x] **Step 4: Implement password hashing**

`backend/src/shared/password.ts`:

```ts
import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(
  hashed: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    // A stored value that is not a valid argon2 encoding is a failed login,
    // not a crash. Callers cannot tell the difference and should not have to.
    return false;
  }
}
```

The library's defaults are the current argon2id recommendations; overriding
memory and time cost here would be picking numbers with no measurement behind
them.

- [x] **Step 5: Write the failing JWT test**

`backend/tests/unit/jwt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { signToken, verifyToken } from '../../src/shared/jwt.js';
import { env } from '../../src/shared/env.js';

describe('JWT', () => {
  it('round-trips a user id', async () => {
    const token = await signToken('user-1');
    expect(await verifyToken(token)).toBe('user-1');
  });

  it('returns null for a malformed token', async () => {
    expect(await verifyToken('not-a-token')).toBeNull();
  });

  it('returns null for a token signed with another secret', async () => {
    const forged = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode('a-different-secret'));

    expect(await verifyToken(forged)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const expired = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.JWT_SECRET));

    expect(await verifyToken(expired)).toBeNull();
  });
});
```

The forged-signature test is the one worth having. A verifier that decodes the
payload without checking the signature passes the round-trip test and hands out
any account to anyone who can base64-encode a JSON object.

- [x] **Step 6: Implement the JWT module**

`backend/src/shared/jwt.ts`:

```ts
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALGORITHM = 'HS256';

/** Signs a 7-day token whose subject is the user id. */
export async function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/** Returns the user id, or null for any token that is not valid right now. */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
    });
    return payload.sub ?? null;
  } catch {
    // Malformed, expired, wrong signature, wrong algorithm — all of them mean
    // the same thing to the caller: there is no authenticated user.
    return null;
  }
}
```

`algorithms: [ALGORITHM]` is not decoration. Without it a verifier accepts
whatever algorithm the token's own header claims, which is how `alg: none`
attacks work.

Seven days comes from `backend.md` section 6. There is no refresh token, by the
same decision.

- [x] **Step 7: Run the tests**

Run: `npm test -w @financy/backend`
Expected: PASS — 9 new tests.

- [x] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(backend): add password hashing and JWT signing

verifyToken pins the algorithm rather than trusting the token header,
and returns null for every failure mode: a verifier that reads the
payload without checking the signature passes a round-trip test and
still hands out any account."
```

---

### Task 3: Errors, request context and the auth guard

The three pieces that make ownership enforceable. Built before the service, so
the service has something to throw and something to trust.

**Files:**
- Create: `backend/src/shared/errors.ts`
- Create: `backend/src/shared/auth-guard.ts`
- Create: `backend/src/context.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/unit/auth-guard.test.ts`
- Test: `backend/tests/integration/context.test.ts`

**Interfaces:**
- Consumes: `verifyToken` from `src/shared/jwt.ts`.
- Produces: `unauthenticated()`, `notFound()`, `badUserInput()`, `emailAlreadyExists()`, `invalidCredentials()` from `src/shared/errors.ts`, each returning a `GraphQLError`. `GraphQLContext = { userId: string | null }` and `createContext({ req }): Promise<GraphQLContext>` from `src/context.ts`. `requireUser(context: GraphQLContext): string` from `src/shared/auth-guard.ts`.

- [x] **Step 1: Write the error module**

`backend/src/shared/errors.ts`:

```ts
import { GraphQLError } from 'graphql';

/** The codes in `backend.md` section 7. The frontend switches on these. */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;

function graphqlError(
  code: (typeof ErrorCode)[keyof typeof ErrorCode],
  message: string,
  extensions: Record<string, unknown> = {},
): GraphQLError {
  return new GraphQLError(message, { extensions: { code, ...extensions } });
}

export const unauthenticated = () =>
  graphqlError(ErrorCode.UNAUTHENTICATED, 'Autenticação obrigatória');

export const notFound = (what = 'Recurso') =>
  graphqlError(ErrorCode.NOT_FOUND, `${what} não encontrado`);

export const badUserInput = (
  message: string,
  fieldErrors: Record<string, string[]> = {},
) => graphqlError(ErrorCode.BAD_USER_INPUT, message, { fieldErrors });

export const emailAlreadyExists = () =>
  graphqlError(ErrorCode.EMAIL_ALREADY_EXISTS, 'Este e-mail já está em uso');

export const invalidCredentials = () =>
  graphqlError(ErrorCode.INVALID_CREDENTIALS, 'E-mail ou senha incorretos');
```

`invalidCredentials` takes no argument on purpose. An unknown email and a wrong
password must be indistinguishable, and the cheapest way to guarantee that is to
give the caller no way to vary the message.

`fieldErrors` exists because `frontend.md` section 8 maps server field errors
back onto their fields. It stays an empty object rather than being absent, so
the frontend reads one shape.

- [x] **Step 2: Write the failing guard test**

`backend/tests/unit/auth-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { requireUser } from '../../src/shared/auth-guard.js';

describe('requireUser', () => {
  it('returns the user id from an authenticated context', () => {
    expect(requireUser({ userId: 'user-1' })).toBe('user-1');
  });

  it('throws UNAUTHENTICATED when there is no user', () => {
    expect(() => requireUser({ userId: null })).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      }),
    );
  });
});
```

- [x] **Step 3: Implement the guard**

`backend/src/shared/auth-guard.ts`:

```ts
import type { GraphQLContext } from '../context.js';
import { unauthenticated } from './errors.js';

/**
 * The single entry point to a user id. Every authenticated resolver starts
 * here, so no resolver has the option of reading `context.userId` and
 * forgetting to check it.
 */
export function requireUser(context: GraphQLContext): string {
  if (!context.userId) throw unauthenticated();
  return context.userId;
}
```

- [x] **Step 4: Implement the context**

`backend/src/context.ts`:

```ts
import type { Request } from 'express';
import { verifyToken } from './shared/jwt.js';

export interface GraphQLContext {
  userId: string | null;
}

const BEARER = /^Bearer (.+)$/;

/**
 * Resolves the bearer token into a user id exactly once per request. A missing,
 * malformed or expired token produces a context with no user rather than an
 * error: whether that is allowed is the resolver's decision, not the
 * transport's — `signIn` is reached without a token by definition.
 */
export async function createContext({
  req,
}: {
  req: Request;
}): Promise<GraphQLContext> {
  const header = req.headers.authorization;
  const match = header ? BEARER.exec(header) : null;
  if (!match?.[1]) return { userId: null };

  return { userId: await verifyToken(match[1]) };
}
```

- [x] **Step 5: Wire the context into the app**

In `backend/src/app.ts`, type the server and pass the context factory:

```ts
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './shared/env.js';
import { resolvers, typeDefs } from './schema.js';
import { createContext, type GraphQLContext } from './context.js';

export async function createApp(): Promise<{
  app: Express;
  apollo: ApolloServer<GraphQLContext>;
}> {
  const apollo = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  await apollo.start();

  const app = express();

  app.use(
    '/graphql',
    cors({ origin: [env.CORS_ORIGIN], credentials: true }),
    express.json(),
    expressMiddleware(apollo, { context: createContext }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return { app, apollo };
}
```

Nothing else in `app.ts` changes. The CORS configuration and its three tests
stay exactly as slice 0 left them.

- [x] **Step 6: Write the context integration test**

`backend/tests/integration/context.test.ts` proves the wiring end to end,
which the unit tests cannot: a real HTTP request carrying a real header reaches
a resolver with the right `userId`. Add a temporary probe query? No — instead
assert through the guard's observable behavior once `me` exists, in task 6. For
now this file asserts the two pure cases of `createContext` against a fake
request object:

```ts
import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { createContext } from '../../src/context.js';
import { signToken } from '../../src/shared/jwt.js';

function requestWith(authorization?: string) {
  return { headers: authorization ? { authorization } : {} } as Request;
}

describe('createContext', () => {
  it('resolves a valid bearer token to its user id', async () => {
    const token = await signToken('user-1');
    expect(await createContext({ req: requestWith(`Bearer ${token}`) })).toEqual(
      { userId: 'user-1' },
    );
  });

  it('has no user when the header is absent', async () => {
    expect(await createContext({ req: requestWith() })).toEqual({
      userId: null,
    });
  });

  it('has no user when the scheme is not Bearer', async () => {
    const token = await signToken('user-1');
    expect(await createContext({ req: requestWith(`Basic ${token}`) })).toEqual({
      userId: null,
    });
  });

  it('has no user when the token is garbage', async () => {
    expect(
      await createContext({ req: requestWith('Bearer not-a-token') }),
    ).toEqual({ userId: null });
  });
});
```

- [x] **Step 7: Run the tests**

Run: `npm test -w @financy/backend`
Expected: PASS — 6 new tests, and slice 0's health and CORS tests still green.

- [x] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(backend): add error codes, request context and the auth guard

A bad token yields a context with no user rather than an error. Whether
that is allowed belongs to the resolver — signIn is reached without a
token by definition — and requireUser is the only way to read a user
id, so no resolver can read it and forget to check."
```

---

### Task 4: Auth input validation

Pure logic, isolated, and the place where `backend.md` section 7's rules become
executable. Written before the service so the service can assume its inputs are
already clean.

**Files:**
- Create: `backend/src/modules/auth/validation.ts`
- Test: `backend/tests/unit/auth-validation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `signUpSchema`, `signInSchema`, `updateProfileSchema` and their inferred types from `src/modules/auth/validation.ts`, plus `parseInput<T>(schema, input): T`, which converts a zod failure into a `BAD_USER_INPUT` error.

- [x] **Step 1: Write the failing test**

`backend/tests/unit/auth-validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  parseInput,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from '../../src/modules/auth/validation.js';

const validSignUp = {
  name: 'Ana Souza',
  email: 'Ana@Exemplo.COM',
  password: 'uma-senha-boa',
};

describe('signUpSchema', () => {
  it('lowercases the email', () => {
    expect(parseInput(signUpSchema, validSignUp).email).toBe('ana@exemplo.com');
  });

  it('trims the name', () => {
    expect(parseInput(signUpSchema, { ...validSignUp, name: '  Ana  ' }).name)
      .toBe('Ana');
  });

  it('rejects a name that is only whitespace', () => {
    expect(() => parseInput(signUpSchema, { ...validSignUp, name: '   ' }))
      .toThrow(expect.objectContaining({
        extensions: expect.objectContaining({ code: 'BAD_USER_INPUT' }),
      }));
  });

  it('rejects a name over 100 characters', () => {
    expect(() =>
      parseInput(signUpSchema, { ...validSignUp, name: 'a'.repeat(101) }),
    ).toThrow(/BAD_USER_INPUT|nome|name/i);
  });

  it('rejects a malformed email', () => {
    expect(() => parseInput(signUpSchema, { ...validSignUp, email: 'ana' }))
      .toThrow();
  });

  it('rejects a password under 8 characters', () => {
    expect(() => parseInput(signUpSchema, { ...validSignUp, password: '1234567' }))
      .toThrow();
  });

  it('accepts a password of exactly 8 characters', () => {
    expect(parseInput(signUpSchema, { ...validSignUp, password: '12345678' }))
      .toBeTruthy();
  });

  it('names the failing field', () => {
    try {
      parseInput(signUpSchema, { ...validSignUp, password: 'short' });
      throw new Error('should have thrown');
    } catch (error) {
      const { extensions } = error as { extensions: { fieldErrors: Record<string, string[]> } };
      expect(Object.keys(extensions.fieldErrors)).toContain('password');
    }
  });
});

describe('signInSchema', () => {
  it('lowercases the email', () => {
    expect(parseInput(signInSchema, { email: 'ANA@EXEMPLO.COM', password: 'x' }).email)
      .toBe('ana@exemplo.com');
  });

  it('does not enforce a password length', () => {
    // Sign-in validates against the stored hash, not against today's rules. A
    // length check here would lock out an account created under an older one,
    // and would leak that the password is short before checking anything.
    expect(parseInput(signInSchema, { email: 'ana@exemplo.com', password: 'x' }))
      .toBeTruthy();
  });
});

describe('updateProfileSchema', () => {
  it('accepts a name', () => {
    expect(parseInput(updateProfileSchema, { name: 'Ana Souza' }).name)
      .toBe('Ana Souza');
  });

  it('rejects an empty name', () => {
    expect(() => parseInput(updateProfileSchema, { name: '' })).toThrow();
  });

  it('ignores an email if one is supplied', () => {
    const parsed = parseInput(updateProfileSchema, {
      name: 'Ana',
      email: 'nova@exemplo.com',
    } as { name: string });
    expect(parsed).toEqual({ name: 'Ana' });
  });
});
```

The last test is the one that earns its place. `email` is absent from
`UpdateProfileInput` in the SDL, so GraphQL already rejects it — but the service
is callable directly, and a schema that strips unknown keys is what keeps that
true if the SDL ever changes.

The exactly-eight-characters test exists because a minimum written as `> 8`
instead of `>= 8` passes every other test in this file.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -w @financy/backend -- auth-validation`
Expected: FAIL — cannot resolve `../../src/modules/auth/validation.js`.

- [x] **Step 3: Implement the schemas**

`backend/src/modules/auth/validation.ts`:

```ts
import { z } from 'zod';
import { badUserInput } from '../../shared/errors.js';

const name = z
  .string()
  .trim()
  .min(1, 'O nome é obrigatório')
  .max(100, 'O nome deve ter no máximo 100 caracteres');

const email = z
  .email('Informe um e-mail válido')
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres');

export const signUpSchema = z.object({ name, email, password });

export const signInSchema = z.object({
  email,
  // Deliberately unconstrained: sign-in checks the stored hash, not today's
  // password policy.
  password: z.string(),
});

export const updateProfileSchema = z.object({ name });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Parses at a service boundary, turning a zod failure into the BAD_USER_INPUT
 * error the frontend knows how to render, with the failing fields named.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const { fieldErrors } = z.flattenError(result.error);
  const firstMessage =
    result.error.issues[0]?.message ?? 'Dados inválidos';

  throw badUserInput(firstMessage, fieldErrors as Record<string, string[]>);
}
```

`z.email()` rather than `z.string().email()`: the latter is deprecated in zod 4.
The same version note from slice 0 applies — `required_error` is silently
ignored, so every message is set positionally or through `.min`.

zod strips unknown keys by default, which is what makes the `updateProfile`
test pass without an explicit `.strip()`.

- [x] **Step 4: Run the tests**

Run: `npm test -w @financy/backend`
Expected: PASS — 14 new tests.

- [x] **Step 5: Commit**

```bash
git add backend
git commit -m "feat(backend): validate auth inputs with zod

Sign-in deliberately does not enforce the password policy: applying
today's minimum to an existing account locks out its owner and reveals
that the stored password is short before anything is checked."
```

---

### Task 5: The auth service

Business rules, taking no request context and returning no GraphQL types. This
is the layer `backend.md` section 3 puts between resolvers and Prisma.

**Files:**
- Create: `backend/src/modules/auth/service.ts`
- Test: `backend/tests/integration/auth-service.test.ts`
- Create: `backend/tests/helpers/factories.ts`

**Interfaces:**
- Consumes: `prisma`, `hashPassword`, `verifyPassword`, `signToken`, the validation schemas, the error helpers.
- Produces, from `src/modules/auth/service.ts`: `signUp(input): Promise<AuthResult>`, `signIn(input): Promise<AuthResult>`, `getUser(userId): Promise<User>`, `updateProfile(userId, input): Promise<User>`, where `AuthResult = { token: string; user: User }` and `User` is the Prisma model.

- [x] **Step 1: Write the test factory**

`backend/tests/helpers/factories.ts`:

```ts
import { prisma } from '../../src/shared/prisma.js';
import { hashPassword } from '../../src/shared/password.js';

let sequence = 0;

/** Creates a user directly, bypassing the service under test. */
export async function createUser(
  overrides: { name?: string; email?: string; password?: string } = {},
) {
  sequence += 1;
  const password = overrides.password ?? 'uma-senha-boa';
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Usuário ${sequence}`,
      email: overrides.email ?? `usuario${sequence}@exemplo.com`,
      passwordHash: await hashPassword(password),
    },
  });

  return { user, password };
}
```

The factory writes through Prisma rather than through `signUp`, so a test of
sign-in does not fail because sign-up is broken.

- [x] **Step 2: Write the failing service test**

`backend/tests/integration/auth-service.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { verifyToken } from '../../src/shared/jwt.js';
import { verifyPassword } from '../../src/shared/password.js';
import {
  getUser,
  signIn,
  signUp,
  updateProfile,
} from '../../src/modules/auth/service.js';
import { resetDatabase } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

const codeIs = (code: string) =>
  expect.objectContaining({
    extensions: expect.objectContaining({ code }),
  });

describe('signUp', () => {
  it('creates the user and returns a usable token', async () => {
    const { token, user } = await signUp({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'uma-senha-boa',
    });

    expect(user.name).toBe('Ana Souza');
    expect(await verifyToken(token)).toBe(user.id);
  });

  it('stores a hash, never the password', async () => {
    const { user } = await signUp({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'uma-senha-boa',
    });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.passwordHash).not.toBe('uma-senha-boa');
    expect(await verifyPassword(stored.passwordHash, 'uma-senha-boa')).toBe(true);
  });

  it('normalizes the email to lowercase', async () => {
    const { user } = await signUp({
      name: 'Ana Souza',
      email: 'Ana@Exemplo.COM',
      password: 'uma-senha-boa',
    });

    expect(user.email).toBe('ana@exemplo.com');
  });

  it('rejects an email that is already registered', async () => {
    await createUser({ email: 'ana@exemplo.com' });

    await expect(
      signUp({
        name: 'Outra Ana',
        email: 'ana@exemplo.com',
        password: 'uma-senha-boa',
      }),
    ).rejects.toThrow(codeIs('EMAIL_ALREADY_EXISTS'));
  });

  it('rejects an email already registered in another case', async () => {
    await createUser({ email: 'ana@exemplo.com' });

    await expect(
      signUp({
        name: 'Outra Ana',
        email: 'ANA@EXEMPLO.COM',
        password: 'uma-senha-boa',
      }),
    ).rejects.toThrow(codeIs('EMAIL_ALREADY_EXISTS'));
  });

  it('rejects a short password', async () => {
    await expect(
      signUp({ name: 'Ana', email: 'ana@exemplo.com', password: 'curta' }),
    ).rejects.toThrow(codeIs('BAD_USER_INPUT'));
  });
});

describe('signIn', () => {
  it('returns a token for the right password', async () => {
    const { user, password } = await createUser();

    const result = await signIn({ email: user.email, password });

    expect(await verifyToken(result.token)).toBe(user.id);
  });

  it('accepts the email in any case', async () => {
    const { user, password } = await createUser({ email: 'ana@exemplo.com' });

    const result = await signIn({ email: 'ANA@Exemplo.com', password });

    expect(await verifyToken(result.token)).toBe(user.id);
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const { user } = await createUser();

    await expect(
      signIn({ email: user.email, password: 'senha-errada' }),
    ).rejects.toThrow(codeIs('INVALID_CREDENTIALS'));
  });

  it('rejects an unknown email with the same code and message', async () => {
    const { user } = await createUser();

    const wrongPassword = await signIn({
      email: user.email,
      password: 'senha-errada',
    }).catch((error: Error) => error);
    const unknownEmail = await signIn({
      email: 'ninguem@exemplo.com',
      password: 'senha-errada',
    }).catch((error: Error) => error);

    expect((unknownEmail as Error).message).toBe((wrongPassword as Error).message);
  });
});

describe('getUser', () => {
  it('returns the user', async () => {
    const { user } = await createUser();
    expect((await getUser(user.id)).id).toBe(user.id);
  });

  it('throws NOT_FOUND for an id that does not exist', async () => {
    await expect(getUser('missing')).rejects.toThrow(codeIs('NOT_FOUND'));
  });
});

describe('updateProfile', () => {
  it('changes the name', async () => {
    const { user } = await createUser({ name: 'Ana' });

    const updated = await updateProfile(user.id, { name: 'Ana Souza' });

    expect(updated.name).toBe('Ana Souza');
  });

  it('leaves the email untouched', async () => {
    const { user } = await createUser({ email: 'ana@exemplo.com' });

    const updated = await updateProfile(user.id, {
      name: 'Ana Souza',
      email: 'nova@exemplo.com',
    } as { name: string });

    expect(updated.email).toBe('ana@exemplo.com');
  });

  it('does not let one user rename another', async () => {
    const { user: ana } = await createUser({ name: 'Ana' });
    const { user: bruno } = await createUser({ name: 'Bruno' });

    await updateProfile(ana.id, { name: 'Ana Souza' });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: bruno.id },
    });
    expect(stored.name).toBe('Bruno');
  });

  it('rejects an empty name', async () => {
    const { user } = await createUser();
    await expect(updateProfile(user.id, { name: '  ' })).rejects.toThrow(
      codeIs('BAD_USER_INPUT'),
    );
  });
});
```

The identical-message test for sign-in is the one that must not be deleted.
Two distinct messages turn the login endpoint into an oracle for which addresses
have accounts, and nothing else in the suite would notice.

- [x] **Step 3: Run the test to verify it fails**

Run: `npm test -w @financy/backend -- auth-service`
Expected: FAIL — cannot resolve `../../src/modules/auth/service.js`.

- [x] **Step 4: Implement the service**

`backend/src/modules/auth/service.ts`:

```ts
import type { User } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { hashPassword, verifyPassword } from '../../shared/password.js';
import { signToken } from '../../shared/jwt.js';
import {
  emailAlreadyExists,
  invalidCredentials,
  notFound,
} from '../../shared/errors.js';
import {
  parseInput,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from './validation.js';

export interface AuthResult {
  token: string;
  user: User;
}

export async function signUp(input: unknown): Promise<AuthResult> {
  const { name, email, password } = parseInput(signUpSchema, input);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw emailAlreadyExists();

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });

  return { token: await signToken(user.id), user };
}

export async function signIn(input: unknown): Promise<AuthResult> {
  const { email, password } = parseInput(signInSchema, input);

  const user = await prisma.user.findUnique({ where: { email } });
  // The unknown-email branch still verifies nothing and returns the same error
  // as a wrong password. Distinguishing them turns this into a way to discover
  // which addresses have accounts.
  if (!user) throw invalidCredentials();

  const matches = await verifyPassword(user.passwordHash, password);
  if (!matches) throw invalidCredentials();

  return { token: await signToken(user.id), user };
}

export async function getUser(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Usuário');
  return user;
}

export async function updateProfile(
  userId: string,
  input: unknown,
): Promise<User> {
  const { name } = parseInput(updateProfileSchema, input);

  // updateMany scoped by id rather than update, matching the ownership rule in
  // backend.md section 6: the filter is in the where clause, and the affected
  // count is what says whether the row existed.
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { name },
  });
  if (count === 0) throw notFound('Usuário');

  return getUser(userId);
}
```

The unique check before `create` is a friendly error, not the guarantee. The
`@unique` constraint from task 1 is the guarantee, and it is what holds when two
sign-ups arrive at once. If Prisma raises `P2002` here anyway, that is the
constraint doing its job — the service does not need to catch it to be correct,
and slice 1 does not add a test for a race it cannot deterministically produce.

- [x] **Step 5: Run the tests**

Run: `npm test -w @financy/backend`
Expected: PASS — 17 new tests.

- [x] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(backend): add the auth service

An unknown email and a wrong password return the same error object.
Two distinct messages would make the login endpoint a way to discover
which addresses have accounts, and no other test would catch it."
```

---

### Task 6: The auth module — SDL, resolvers and the DateTime scalar

The transport layer. Resolvers extract the user id through the guard, call the
service, and do nothing else.

**Files:**
- Create: `backend/src/modules/auth/schema.ts`
- Create: `backend/src/modules/auth/resolvers.ts`
- Modify: `backend/src/schema.ts`
- Test: `backend/tests/integration/auth.test.ts`
- Create: `backend/tests/helpers/graphql.ts`

**Interfaces:**
- Consumes: the auth service, `requireUser`, `GraphQLContext`.
- Produces: `authTypeDefs` and `authResolvers` from `src/modules/auth/`; a merged `typeDefs` and `resolvers` from `src/schema.ts`; `execute()` from `tests/helpers/graphql.ts`.

- [x] **Step 1: Install the scalar**

```bash
npm install -w @financy/backend graphql-scalars
```

`backend.md` section 5 declares `scalar DateTime`. A custom scalar that is not
given a resolver silently passes values through unvalidated, so a malformed date
becomes a malformed string in the response rather than an error.
`DateTimeISOResolver` serializes to an ISO 8601 string, which is what
`frontend.md` section 9 expects to parse.

- [x] **Step 2: Write the auth SDL**

`backend/src/modules/auth/schema.ts`:

```ts
export const authTypeDefs = /* GraphQL */ `
  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input SignUpInput {
    name: String!
    email: String!
    password: String!
  }

  input SignInInput {
    email: String!
    password: String!
  }

  input UpdateProfileInput {
    name: String!
  }

  extend type Query {
    me: User!
  }

  extend type Mutation {
    signUp(input: SignUpInput!): AuthPayload!
    signIn(input: SignInInput!): AuthPayload!
    updateProfile(input: UpdateProfileInput!): User!
  }
`;
```

`User.passwordHash` is absent, per `backend.md` section 5. A field that does not
exist cannot be queried, which is a stronger guarantee than remembering to omit
it from every selection.

`email` is absent from `UpdateProfileInput` for the reason the spec gives: email
is the login identifier, and changing it is account recovery, not a profile
edit.

`extend type` rather than `type`, so slices 2 and 3 add their own fields to the
same root types without any module owning them.

- [x] **Step 3: Write the resolvers**

`backend/src/modules/auth/resolvers.ts`:

```ts
import type { GraphQLContext } from '../../context.js';
import { requireUser } from '../../shared/auth-guard.js';
import { getUser, signIn, signUp, updateProfile } from './service.js';

export const authResolvers = {
  Query: {
    me: (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      getUser(requireUser(context)),
  },

  Mutation: {
    signUp: (_parent: unknown, { input }: { input: unknown }) => signUp(input),

    signIn: (_parent: unknown, { input }: { input: unknown }) => signIn(input),

    updateProfile: (
      _parent: unknown,
      { input }: { input: unknown },
      context: GraphQLContext,
    ) => updateProfile(requireUser(context), input),
  },
};
```

`signUp` and `signIn` take no context: they are the two operations reachable
without a token, and giving them one would invite a future edit to read it.

Task 7 replaces these hand-written parameter types with generated ones. They are
written out here so this task's tests pass on their own.

- [x] **Step 4: Merge the module into the schema**

`backend/src/schema.ts`:

```ts
import { DateTimeISOResolver } from 'graphql-scalars';
import { authTypeDefs } from './modules/auth/schema.js';
import { authResolvers } from './modules/auth/resolvers.js';

const rootTypeDefs = /* GraphQL */ `
  scalar DateTime

  type Query {
    health: String!
  }

  type Mutation {
    _empty: Boolean
  }
`;

export const typeDefs = [rootTypeDefs, authTypeDefs];

export const resolvers = {
  DateTime: DateTimeISOResolver,

  Query: {
    health: () => 'ok',
    ...authResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
  },
};
```

`Mutation._empty` exists so `extend type Mutation` has something to extend —
GraphQL has no empty type. It is removed the moment a second module makes it
unnecessary; until then, deleting it breaks the schema build.

Slice 0's `health` query stays. Its tests still pass, and a liveness check that
does not need a token is worth keeping.

- [x] **Step 5: Write the GraphQL test helper**

`backend/tests/helpers/graphql.ts`:

```ts
import request from 'supertest';
import type { Express } from 'express';

interface ExecuteOptions {
  query: string;
  variables?: Record<string, unknown>;
  token?: string;
}

/** Runs an operation through the real HTTP stack, optionally authenticated. */
export async function execute(app: Express, options: ExecuteOptions) {
  const call = request(app).post('/graphql');
  if (options.token) call.set('Authorization', `Bearer ${options.token}`);

  const response = await call.send({
    query: options.query,
    variables: options.variables,
  });

  return response.body as {
    data?: Record<string, unknown> | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

/** The error code of the first error, or undefined if the operation succeeded. */
export function errorCode(body: { errors?: { extensions?: { code?: string } }[] }) {
  return body.errors?.[0]?.extensions?.code;
}
```

Going through supertest rather than calling the resolver directly is the point:
it exercises the context, the guard, the resolver, the service, the validation
and Prisma in one pass, which is where `roadmap.md` puts the weight.

- [x] **Step 6: Write the failing integration test**

`backend/tests/integration/auth.test.ts`:

```ts
import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/prisma.js';
import { signToken } from '../../src/shared/jwt.js';
import { resetDatabase } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { errorCode, execute } from '../helpers/graphql.js';

let app: Express;
let apollo: ApolloServer;

const SIGN_UP = /* GraphQL */ `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      token
      user { id name email createdAt }
    }
  }
`;

const SIGN_IN = /* GraphQL */ `
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) { token user { id email } }
  }
`;

const ME = /* GraphQL */ `
  query Me { me { id name email createdAt } }
`;

const UPDATE_PROFILE = /* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) { id name email }
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
        mutation { signUp(input: {
          name: "Ana", email: "ana@exemplo.com", password: "uma-senha-boa"
        }) { user { passwordHash } } }
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

    expect((body.data?.updateProfile as { name: string }).name).toBe('Ana Souza');
  });

  it('cannot change the email', async () => {
    const { user } = await createUser({ email: 'ana@exemplo.com' });

    const body = await execute(app, {
      query: /* GraphQL */ `
        mutation { updateProfile(input: {
          name: "Ana", email: "nova@exemplo.com"
        }) { email } }
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
```

`roadmap.md` requires four cases per operation: success, each validation
failure, unauthenticated, and cross-user. Slice 1's cross-user surface is
narrow — every operation here is scoped to the caller's own id and there is no
`id` argument to tamper with — so the cross-user tests take the form of asserting
that one user's write does not reach another's row. Slices 2 and 3, which do
take ids, get the `NOT_FOUND` form the spec describes.

- [x] **Step 7: Run the tests**

Run: `npm test -w @financy/backend`
Expected: PASS — 17 new tests.

- [x] **Step 8: Verify by hand**

Run `npm run dev:backend`, then:

```bash
curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signUp(input: {name: \"Ana\", email: \"ana@exemplo.com\", password: \"uma-senha-boa\"}) { token user { id name } } }"}'
```

Expected: a token and the user. Then call `me` with that token in an
`Authorization: Bearer` header and expect the same user back. Stop the server.

If sign-up fails with a missing-table error, `dev.db` has no migrations —
run `npm run db:migrate -w @financy/backend`.

- [x] **Step 9: Commit**

```bash
git add backend
git commit -m "feat(backend): add the auth module

Resolvers reach a user id only through requireUser, and the SDL has no
passwordHash field at all: a field that does not exist cannot be
selected, which beats remembering to omit it."
```

---

### Task 7: Typed resolvers and a committed schema file

`backend.md` section 2 chooses graphql-codegen with `typescript-resolvers` to
keep hand-written SDL and resolvers in sync. This task adds it, and emits the
printed schema that the frontend's codegen reads without running the server.

**Files:**
- Create: `backend/codegen.ts`
- Create: `backend/src/graphql/generated/resolvers.ts` (generated, committed)
- Create: `backend/schema.graphql` (generated, committed)
- Modify: `backend/src/modules/auth/resolvers.ts`
- Modify: `backend/package.json`
- Test: `backend/tests/unit/schema-artifact.test.ts`

**Interfaces:**
- Consumes: the module SDL.
- Produces: `Resolvers` and the operation argument types from `src/graphql/generated/resolvers.ts`; `backend/schema.graphql`, the printed schema.

- [x] **Step 1: Install**

```bash
npm install -w @financy/backend -D @graphql-codegen/cli \
  @graphql-codegen/typescript @graphql-codegen/typescript-resolvers \
  @graphql-codegen/schema-ast
```

- [x] **Step 2: Write the codegen config**

`backend/codegen.ts`:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  // The SDL is plucked out of the /* GraphQL */ template literals in these
  // files. That is why the module SDL lives in schema.ts rather than in a
  // .graphql file: no build step has to copy it into dist.
  schema: ['src/schema.ts', 'src/modules/**/schema.ts'],
  generates: {
    'src/graphql/generated/resolvers.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../../context.js#GraphQLContext',
        mappers: {
          User: '@prisma/client#User as UserModel',
        },
        scalars: { DateTime: 'Date' },
        useTypeImports: true,
      },
    },
    'schema.graphql': {
      plugins: ['schema-ast'],
    },
  },
};

export default config;
```

The `User` mapper is what makes the resolvers type-check honestly. Without it,
codegen assumes a resolver returns the GraphQL `User` shape, and returning the
Prisma model — which carries `passwordHash` and `updatedAt` — either fails or,
worse, forces a cast that hides a real mismatch later.

`scalars: { DateTime: 'Date' }` stops the scalar from generating as `any`, which
the lint config rejects everywhere it is not in a `generated/` directory.

`schema.graphql` at the workspace root is the artifact the frontend consumes.
Committing it is what lets a fresh clone run the frontend's codegen without
starting the backend.

- [x] **Step 3: Add the scripts**

In `backend/package.json`:

```json
"codegen": "graphql-codegen --config codegen.ts",
"codegen:check": "graphql-codegen --config codegen.ts && git diff --exit-code schema.graphql src/graphql/generated"
```

- [x] **Step 4: Generate**

Run: `npm run codegen -w @financy/backend`
Expected: `src/graphql/generated/resolvers.ts` and `schema.graphql` written.

Open `schema.graphql` and confirm it contains `type User`, `AuthPayload`, the
three mutations and `me` — and no `passwordHash`.

- [x] **Step 5: Type the resolvers with the generated types**

Rewrite `backend/src/modules/auth/resolvers.ts`:

```ts
import type { Resolvers } from '../../graphql/generated/resolvers.js';
import { requireUser } from '../../shared/auth-guard.js';
import { getUser, signIn, signUp, updateProfile } from './service.js';

export const authResolvers: Resolvers = {
  Query: {
    me: (_parent, _args, context) => getUser(requireUser(context)),
  },

  Mutation: {
    signUp: (_parent, { input }) => signUp(input),
    signIn: (_parent, { input }) => signIn(input),
    updateProfile: (_parent, { input }, context) =>
      updateProfile(requireUser(context), input),
  },
};
```

Every parameter type now comes from the schema. Renaming a field in the SDL
without touching the resolver is a compile error rather than a runtime `null`.

`src/schema.ts` needs one adjustment for the same reason — its `resolvers` object
spreads `authResolvers.Query` and `authResolvers.Mutation`, both of which are now
optional on the `Resolvers` type. Spread them with `?? {}`:

```ts
  Query: {
    health: () => 'ok',
    ...(authResolvers.Query ?? {}),
  },

  Mutation: {
    ...(authResolvers.Mutation ?? {}),
  },
```

- [x] **Step 6: Write the drift test**

`backend/tests/unit/schema-artifact.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { buildSchema, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { typeDefs } from '../../src/schema.js';

describe('the committed schema artifact', () => {
  it('matches the SDL the server actually serves', () => {
    const committed = buildSchema(
      readFileSync(new URL('../../schema.graphql', import.meta.url), 'utf8'),
    );
    const served = buildSchema(typeDefs.join('\n'));

    expect(printSchema(committed)).toBe(printSchema(served));
  });
});
```

This is the test that keeps the frontend honest. `schema.graphql` is a
generated file that a person has to remember to regenerate; without this, a
backend field rename ships a frontend built against yesterday's schema and the
mismatch appears in the browser instead of in CI.

- [x] **Step 7: Run the checks**

```bash
npm test -w @financy/backend
npm run typecheck -w @financy/backend
npm run lint
```

Expected: all pass. `generated/` is already excluded from lint by slice 0's
`eslint.config.mjs`.

- [x] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(backend): generate resolver types and commit the schema

schema.graphql is committed so the frontend's codegen runs on a fresh
clone without a running backend, and a test compares it against the
SDL the server serves — a stale artifact would otherwise surface as a
frontend type error nobody can explain."
```

---

### Task 8: Typed operations with graphql-codegen

The frontend's half of the codegen setup. It reads the schema file task 7
committed, so this runs on a fresh clone with no backend process.

**Files:**
- Create: `frontend/codegen.ts`
- Create: `frontend/src/graphql/operations/auth.graphql`
- Create: `frontend/src/graphql/generated/graphql.ts` (generated, committed)
- Modify: `frontend/src/lib/graphql-client.ts`
- Modify: `frontend/package.json`
- Test: `frontend/src/graphql/generated/query-keys.test.ts`

**Interfaces:**
- Consumes: `backend/schema.graphql`.
- Produces: `useMeQuery`, `useSignInMutation`, `useSignUpMutation`, `useUpdateProfileMutation` and their types from `src/graphql/generated/graphql.ts`. `fetcher` from `src/lib/graphql-client.ts`.

- [x] **Step 1: Install**

```bash
npm install -w @financy/frontend -D @graphql-codegen/cli \
  @graphql-codegen/typescript @graphql-codegen/typescript-operations \
  @graphql-codegen/typescript-react-query
```

- [x] **Step 2: Add the fetcher to the client**

In `frontend/src/lib/graphql-client.ts`, append:

```ts
/**
 * The function generated hooks call. It returns a thunk rather than a promise
 * because that is the shape TanStack Query wants for a query function, and the
 * same shape works for a mutation.
 */
export function fetcher<TData, TVariables extends Record<string, unknown>>(
  document: string,
  variables?: TVariables,
): () => Promise<TData> {
  return () => graphqlClient.request<TData>(document, variables);
}
```

`setAuthToken` and `graphqlClient` stay exactly as they are. The header is set
on the client, so every generated hook picks it up without knowing it exists.

- [x] **Step 3: Write the operations**

`frontend/src/graphql/operations/auth.graphql`:

```graphql
query Me {
  me {
    id
    name
    email
    createdAt
  }
}

mutation SignIn($input: SignInInput!) {
  signIn(input: $input) {
    token
    user {
      id
      name
      email
      createdAt
    }
  }
}

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

mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    id
    name
    email
    createdAt
  }
}
```

Codegen validates these documents against the schema, so a field that does not
exist — or a variable declared and never passed — fails generation rather than
returning `null` in the browser. That validation is the main reason to run
codegen at all.

Every operation selects the same `User` fields. That is what lets `signIn` seed
the `Me` cache in task 11 without a second request.

- [x] **Step 4: Write the codegen config**

`frontend/codegen.ts`:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  // The committed artifact, not a running server: a fresh clone generates
  // without starting the backend, and CI does not need a database.
  schema: '../backend/schema.graphql',
  documents: ['src/graphql/operations/**/*.graphql'],
  generates: {
    'src/graphql/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-query',
      ],
      config: {
        reactQueryVersion: 5,
        fetcher: '@/lib/graphql-client#fetcher',
        exposeQueryKeys: true,
        exposeFetcher: true,
        // DateTime arrives as an ISO string and is formatted at render.
        // Deserializing to a Date here would mean the cache holds a value that
        // does not survive a structural clone.
        scalars: { DateTime: 'string' },
      },
    },
  },
};

export default config;
```

- [x] **Step 5: Add the scripts**

In `frontend/package.json`:

```json
"codegen": "graphql-codegen --config codegen.ts",
"codegen:check": "graphql-codegen --config codegen.ts && git diff --exit-code src/graphql/generated"
```

- [x] **Step 6: Generate**

Run: `npm run codegen -w @financy/frontend`
Expected: `src/graphql/generated/graphql.ts` written, exporting `useMeQuery`,
`useSignInMutation`, `useSignUpMutation` and `useUpdateProfileMutation`.

- [x] **Step 7: Pin the query keys with a test**

`frontend/src/graphql/generated/query-keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { useMeQuery } from './graphql';

describe('generated query keys', () => {
  it('keys the me query on its operation name', () => {
    expect(useMeQuery.getKey()).toEqual(['Me']);
  });
});
```

Invalidation in every later slice is written against these keys. Codegen changing
its key shape between versions would silently stop `updateProfile` from
refreshing the profile screen — an invalidation that matches nothing throws no
error.

The file lives beside the generated code and is hand-written; `generated/` is
excluded from lint, not from the test glob.

- [x] **Step 8: Run the checks**

```bash
npm test -w @financy/frontend
npm run typecheck -w @financy/frontend
```

Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat(frontend): generate typed hooks from the backend schema

Codegen reads the committed schema.graphql rather than a running
server, so a fresh clone and CI both generate without a backend or a
database."
```

---

### Task 9: The Checkbox primitive

`frontend.md` section 3 lists thirteen primitives and no checkbox, but the login
screen has one and it controls where the token is stored. This adds the
fourteenth and amends the table.

**Files:**
- Create: `frontend/src/components/ui/Checkbox.tsx`
- Test: `frontend/src/components/ui/Checkbox.test.tsx`
- Modify: `frontend/src/pages/StyleGuide.tsx`
- Modify: `frontend/src/pages/StyleGuide.test.tsx`
- Modify: `docs/specs/frontend.md`

**Interfaces:**
- Consumes: `cn`.
- Produces: `Checkbox` from `src/components/ui/Checkbox.tsx`, forwarding a ref and accepting `label: string` plus the native input props.

- [x] **Step 1: Write the failing test**

`frontend/src/components/ui/Checkbox.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('associates the label with the control', () => {
    render(<Checkbox label="Lembrar-me" />);
    expect(screen.getByRole('checkbox', { name: 'Lembrar-me' })).toBeInTheDocument();
  });

  it('starts unchecked and toggles on click', async () => {
    render(<Checkbox label="Lembrar-me" />);
    const box = screen.getByRole('checkbox', { name: 'Lembrar-me' });

    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(box).toBeChecked();
  });

  it('toggles from the keyboard', async () => {
    render(<Checkbox label="Lembrar-me" />);
    const box = screen.getByRole('checkbox', { name: 'Lembrar-me' });

    box.focus();
    await userEvent.keyboard(' ');
    expect(box).toBeChecked();
  });

  it('honours defaultChecked', () => {
    render(<Checkbox label="Lembrar-me" defaultChecked />);
    expect(screen.getByRole('checkbox', { name: 'Lembrar-me' })).toBeChecked();
  });

  it('can be disabled', () => {
    render(<Checkbox label="Lembrar-me" disabled />);
    expect(screen.getByRole('checkbox', { name: 'Lembrar-me' })).toBeDisabled();
  });
});
```

The keyboard test is the reason this is a native `<input type="checkbox">` and
not a styled `div` with a click handler. Space-to-toggle, focus order and the
screen reader role all come free from the element and all have to be rebuilt
without it.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -w @financy/frontend -- Checkbox`
Expected: FAIL — cannot resolve `./Checkbox`.

- [x] **Step 3: Implement Checkbox**

`frontend/src/components/ui/Checkbox.tsx`:

```tsx
import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, className, id, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          ref={ref}
          type="checkbox"
          className={cn(
            'size-4 rounded border-gray-300 text-brand-base',
            'accent-brand-base',
            'focus:outline-none focus:ring-2 focus:ring-brand-base/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className="cursor-pointer select-none text-sm text-gray-600"
        >
          {label}
        </label>
      </div>
    );
  },
);
```

`accent-brand-base` colors the native control rather than hiding it behind a
custom box. It is a smaller surface than a peer-styled replacement and it keeps
the platform's focus ring behavior on every browser.

- [x] **Step 4: Add it to the style guide**

In `frontend/src/pages/StyleGuide.tsx`, import `Checkbox` and add a section
after `Input`:

```tsx
      <Section title="Checkbox">
        <Checkbox label="Lembrar-me" />
        <Checkbox label="Marcado" defaultChecked />
        <Checkbox label="Desabilitado" disabled />
      </Section>
```

Extend `StyleGuide.test.tsx`'s heading assertions to include `Checkbox`, the
same way every other section is covered.

- [x] **Step 5: Amend the spec**

In `docs/specs/frontend.md`, section 3, add a row to the component table, placed
after `Select`:

```
| `Checkbox` | native control with a label, default, checked and disabled |
```

The definition of done requires the spec to describe what was built. A primitive
that exists in the code and not in the table is how the design system stops
being the source of truth.

- [x] **Step 6: Run the tests**

Run: `npm test -w @financy/frontend`
Expected: PASS — 5 new tests plus the updated style guide test.

- [x] **Step 7: Commit**

```bash
git add frontend docs/specs/frontend.md
git commit -m "feat(frontend): add the Checkbox primitive

The login screen's Lembrar-me controls localStorage versus
sessionStorage, so it needed a real primitive. Native input rather
than a styled div: space-to-toggle, focus order and the checkbox role
are otherwise all rebuilt by hand."
```

---

### Task 10: Token storage and the MSW test harness

Two independent pieces of groundwork, neither large enough for its own commit:
the storage module the session context wraps, and the network mocking every
screen test from here on depends on.

**Files:**
- Create: `frontend/src/lib/token-storage.ts`
- Create: `frontend/src/test/msw/server.ts`
- Create: `frontend/src/test/msw/api.ts`
- Modify: `frontend/src/test/setup.ts`
- Test: `frontend/src/lib/token-storage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `readToken(): string | null`, `writeToken(token: string, remember: boolean): void`, `clearToken(): void` from `src/lib/token-storage.ts`. `server` from `src/test/msw/server.ts`; `api`, `ok()` and `graphqlError()` from `src/test/msw/api.ts`.

- [x] **Step 1: Write the failing storage test**

`frontend/src/lib/token-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearToken, readToken, writeToken } from './token-storage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('token storage', () => {
  it('returns null when nothing is stored', () => {
    expect(readToken()).toBeNull();
  });

  it('persists across sessions when remember is true', () => {
    writeToken('abc', true);

    expect(localStorage.getItem('financy.token')).toBe('abc');
    expect(sessionStorage.getItem('financy.token')).toBeNull();
    expect(readToken()).toBe('abc');
  });

  it('dies with the tab when remember is false', () => {
    writeToken('abc', false);

    expect(sessionStorage.getItem('financy.token')).toBe('abc');
    expect(localStorage.getItem('financy.token')).toBeNull();
    expect(readToken()).toBe('abc');
  });

  it('does not leave a stale token in the other store', () => {
    writeToken('remembered', true);
    writeToken('temporary', false);

    expect(localStorage.getItem('financy.token')).toBeNull();
    expect(readToken()).toBe('temporary');
  });

  it('clears both stores', () => {
    writeToken('abc', true);
    clearToken();

    expect(readToken()).toBeNull();
    expect(localStorage.getItem('financy.token')).toBeNull();
    expect(sessionStorage.getItem('financy.token')).toBeNull();
  });
});
```

The fourth test is the one with a real bug behind it. Signing in with
"Lembrar-me" and then out and back in without it leaves the first token in
`localStorage`; on the next page load `readToken` finds it and restores a session
the user explicitly asked not to keep.

- [x] **Step 2: Implement token storage**

`frontend/src/lib/token-storage.ts`:

```ts
const KEY = 'financy.token';

/**
 * "Lembrar-me" picks the store: localStorage survives closing the browser,
 * sessionStorage dies with the tab. Reads check both, because which one holds
 * the token is not knowable at read time.
 */
export function readToken(): string | null {
  return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
}

export function writeToken(token: string, remember: boolean): void {
  // Always clear both first. Writing to one store while the other still holds
  // an older token means the next read can resurrect a session that was
  // deliberately made temporary.
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
```

`frontend.md` section 7 states the trade-off this makes: the API returns the JWT
in the response body, so an `httpOnly` cookie is not available without a backend
change, and the token is therefore readable by any script on the page. Nothing
in this module changes that; the mitigation is elsewhere and unchanged — never
render user-supplied HTML, and keep dependencies current.

- [x] **Step 3: Install and configure MSW**

```bash
npm install -w @financy/frontend -D msw
```

`frontend/src/test/msw/server.ts`:

```ts
import { setupServer } from 'msw/node';

// No default handlers. Every test declares the responses it depends on, so a
// test never passes on a fixture some other file happened to register.
export const server = setupServer();
```

`frontend/src/test/msw/api.ts`:

```ts
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
```

- [x] **Step 4: Wire the server into the setup file**

`frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

// 'error' rather than 'warn': a request nobody mocked means the test is
// asserting against a failure it did not intend, which reads as a passing
// error state.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
});

afterAll(() => server.close());
```

- [x] **Step 5: Run the tests**

Run: `npm test -w @financy/frontend`
Expected: PASS — 5 new storage tests, and every existing suite still green.

If suites that make no network calls now fail, the MSW interceptor is running
where it is not wanted — check that nothing imports `graphql-client` at module
load in a component test.

- [x] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add token storage and the MSW test harness

writeToken clears both stores before writing. Otherwise signing in
with Lembrar-me and then out and back in without it leaves the old
token in localStorage, and the next load restores a session the user
asked not to keep."
```

---

### Task 11: The session context

The single place that knows whether there is a session and who it belongs to.

**Files:**
- Create: `frontend/src/features/auth/SessionContext.tsx`
- Create: `frontend/src/features/auth/useSession.ts`
- Create: `frontend/src/test/render.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/features/auth/SessionContext.test.tsx`

**Interfaces:**
- Consumes: `readToken`/`writeToken`/`clearToken`, `setAuthToken`, `useMeQuery`.
- Produces: `SessionProvider` from `src/features/auth/SessionContext.tsx` and `useSession(): Session` from `src/features/auth/useSession.ts`, where `Session = { token: string | null; user: User | null; isLoadingUser: boolean; signIn(token: string, user: User, remember: boolean): void; signOut(): void }`. `renderWithProviders` from `src/test/render.tsx`.

- [x] **Step 1: Write the failing test**

`frontend/src/features/auth/SessionContext.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { readToken, writeToken } from '@/lib/token-storage';
import { useSession } from './useSession';

function Probe() {
  const { token, user, signIn, signOut } = useSession();

  return (
    <div>
      <p>token: {token ?? 'nenhum'}</p>
      <p>user: {user?.name ?? 'nenhum'}</p>
      <button onClick={() => signIn('novo-token', aUser, true)}>entrar</button>
      <button onClick={signOut}>sair</button>
    </div>
  );
}

describe('SessionContext', () => {
  it('starts with no session when storage is empty', () => {
    renderWithProviders(<Probe />);
    expect(screen.getByText('token: nenhum')).toBeInTheDocument();
  });

  it('hydrates the token from storage on load', async () => {
    writeToken('stored-token', true);
    server.use(api.query('Me', () => ok({ me: aUser })));

    renderWithProviders(<Probe />);

    expect(screen.getByText('token: stored-token')).toBeInTheDocument();
    expect(await screen.findByText('user: Ana Souza')).toBeInTheDocument();
  });

  it('does not fetch the user when there is no token', () => {
    // No Me handler is registered. onUnhandledRequest is 'error', so a request
    // fired here fails the test rather than passing quietly.
    renderWithProviders(<Probe />);
    expect(screen.getByText('user: nenhum')).toBeInTheDocument();
  });

  it('signIn stores the token and seeds the user without a request', async () => {
    renderWithProviders(<Probe />);

    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));

    expect(screen.getByText('token: novo-token')).toBeInTheDocument();
    expect(screen.getByText('user: Ana Souza')).toBeInTheDocument();
    expect(readToken()).toBe('novo-token');
  });

  it('signOut clears the token, the user and the cache', async () => {
    writeToken('stored-token', true);
    server.use(api.query('Me', () => ok({ me: aUser })));

    const { queryClient } = renderWithProviders(<Probe />);
    await screen.findByText('user: Ana Souza');

    await userEvent.click(screen.getByRole('button', { name: 'sair' }));

    expect(readToken()).toBeNull();
    expect(screen.getByText('token: nenhum')).toBeInTheDocument();
    // The cache must be emptied, not just invalidated: without this the next
    // user to sign in on this browser sees the previous one's data render
    // from cache before their own arrives.
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('drops the session when the stored token is rejected', async () => {
    writeToken('expired-token', true);
    server.use(api.query('Me', () => graphqlError('UNAUTHENTICATED')));

    renderWithProviders(<Probe />);

    await waitFor(() => expect(readToken()).toBeNull());
    expect(screen.getByText('token: nenhum')).toBeInTheDocument();
  });
});
```

The last test is the reload-with-an-expired-token case. Without it, a user
whose seven days ran out sees a shell that renders and then fails every panel,
rather than the login screen.

- [x] **Step 2: Write the render helper**

`frontend/src/test/render.tsx`:

```tsx
import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '@/features/auth/SessionContext';

interface Options {
  route?: string;
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // No retries in tests: a mocked error would otherwise be requested three
      // more times before the assertion sees it, and every error test would
      // need a timeout instead of an assertion.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>
          <SessionProvider>{children}</SessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) };
}
```

- [x] **Step 3: Run the test to verify it fails**

Run: `npm test -w @financy/frontend -- SessionContext`
Expected: FAIL — cannot resolve `./useSession`.

- [x] **Step 4: Implement the context**

`frontend/src/features/auth/SessionContext.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clearToken, readToken, writeToken } from '@/lib/token-storage';
import { setAuthToken } from '@/lib/graphql-client';
import { useMeQuery, type MeQuery } from '@/graphql/generated/graphql';

export type SessionUser = MeQuery['me'];

export interface Session {
  token: string | null;
  user: SessionUser | null;
  isLoadingUser: boolean;
  signIn(token: string, user: SessionUser, remember: boolean): void;
  signOut(): void;
}

export const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Read synchronously on the first render. An effect would mean one render
  // with no token, which is one render of the login screen for a signed-in
  // user reloading the page.
  const [token, setToken] = useState<string | null>(() => {
    const stored = readToken();
    setAuthToken(stored);
    return stored;
  });

  const queryClient = useQueryClient();

  const meQuery = useMeQuery(undefined, { enabled: token !== null });

  const signOut = useCallback(() => {
    clearToken();
    setAuthToken(null);
    setToken(null);
    // clear(), not invalidateQueries(): the next user on this browser must not
    // see the previous one's data render from cache while their own loads.
    queryClient.clear();
  }, [queryClient]);

  const signIn = useCallback(
    (nextToken: string, user: SessionUser, remember: boolean) => {
      writeToken(nextToken, remember);
      setAuthToken(nextToken);
      setToken(nextToken);
      // Every auth operation selects the same User fields, so the payload the
      // mutation already returned is a complete Me result. Seeding it avoids a
      // round trip and keeps one source of truth for the current user.
      queryClient.setQueryData(useMeQuery.getKey(), { me: user });
    },
    [queryClient],
  );

  // A stored token the server rejects is not a session. Dropping it here is
  // what turns a reload after seven days into the login screen rather than a
  // shell whose every panel fails.
  useEffect(() => {
    if (meQuery.isError && token) signOut();
  }, [meQuery.isError, token, signOut]);

  const value = useMemo<Session>(
    () => ({
      token,
      user: meQuery.data?.me ?? null,
      isLoadingUser: token !== null && meQuery.isPending,
      signIn,
      signOut,
    }),
    [token, meQuery.data, meQuery.isPending, signIn, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
```

`frontend/src/features/auth/useSession.ts`:

```ts
import { useContext } from 'react';
import { SessionContext, type Session } from './SessionContext';

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside a SessionProvider');
  }
  return session;
}
```

The hook is a separate file from the provider because `eslint-plugin-react-refresh`
warns when a module exports both a component and a non-component, and fast
refresh genuinely does break on that.

- [x] **Step 5: Wrap the application**

In `frontend/src/App.tsx`, put `SessionProvider` inside `BrowserRouter` and
inside `QueryClientProvider` — it uses `useQueryClient`, and task 12's guards
call `useNavigate` from within it:

```tsx
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
```

- [x] **Step 6: Run the tests**

Run: `npm test -w @financy/frontend`
Expected: PASS — 6 new tests.

`App.test.tsx` from slice 0 renders `App`, which now mounts `SessionProvider`.
With no token it fires no request, so no handler is needed and the test stays as
it is. If it fails on an unhandled request, `enabled` is wrong.

- [x] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add the session context

The token is read synchronously on the first render rather than in an
effect: an effect means one render with no session, which is one frame
of the login screen for a signed-in user reloading the page."
```

---

### Task 12: Route guards, the auth layout and the routing change

Slice 0's routes render placeholders behind no protection. This makes `/` serve
two screens, puts the private routes behind a guard, and gives the public pages
their own layout.

**Files:**
- Create: `frontend/src/components/layout/RequireAuth.tsx`
- Create: `frontend/src/components/layout/RequireAnonymous.tsx`
- Create: `frontend/src/components/layout/AppLayout.tsx`
- Create: `frontend/src/features/auth/AuthLayout.tsx`
- Modify: `frontend/src/components/layout/TopBar.tsx`
- Modify: `frontend/src/routes.tsx`
- Test: `frontend/src/routes.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `TopBar`, `PageShell`, `Card`.
- Produces: `RequireAuth` and `RequireAnonymous` — each renders an `<Outlet />` or a `<Navigate />`. `AppLayout` — the signed-in shell. `AuthLayout` — the centered public card.

- [x] **Step 1: Write the failing routing test**

`frontend/src/routes.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { api, aUser, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { writeToken } from '@/lib/token-storage';
import { AppRoutes } from './routes';

function signedIn() {
  writeToken('token', true);
  server.use(api.query('Me', () => ok({ me: aUser })));
}

describe('routing', () => {
  it('serves the login screen at / when signed out', () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    expect(screen.getByRole('heading', { name: 'Fazer login' })).toBeInTheDocument();
  });

  it('serves the dashboard at / when signed in', async () => {
    signedIn();
    renderWithProviders(<AppRoutes />, { route: '/' });
    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it('redirects a private route to / when signed out', () => {
    renderWithProviders(<AppRoutes />, { route: '/transactions' });
    expect(screen.getByRole('heading', { name: 'Fazer login' })).toBeInTheDocument();
  });

  it('redirects the sign up route to / when signed in', async () => {
    signedIn();
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it('serves the sign up screen when signed out', () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument();
  });

  it('shows the top bar on a private route and not on a public one', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();

    signedIn();
    renderWithProviders(<AppRoutes />, { route: '/profile' });
    expect(
      await screen.findByRole('navigation', { name: 'Principal' }),
    ).toBeInTheDocument();
  });
});
```

This file is written before the login and sign up pages exist, so it fails on
those headings until tasks 13 and 14. Implement the guards and the routing in
this task, and expect the two heading assertions to stay red until then — note
which ones in the commit, and do not weaken them to make the run green.

- [x] **Step 2: Implement the guards**

`frontend/src/components/layout/RequireAuth.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/features/auth/useSession';

/** Private routes. No token means the login screen, which `/` serves. */
export function RequireAuth() {
  const { token } = useSession();
  return token ? <Outlet /> : <Navigate to="/" replace />;
}
```

`frontend/src/components/layout/RequireAnonymous.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/features/auth/useSession';

/** Public-only routes. A signed-in user has no use for the sign up form. */
export function RequireAnonymous() {
  const { token } = useSession();
  return token ? <Navigate to="/" replace /> : <Outlet />;
}
```

Both decide on `token`, not on `user`. Waiting for `me` to resolve would mean a
guarded route renders nothing on every reload until a request finishes, and the
token is what actually determines whether a request will be authorized.

`replace` rather than a push, so the back button does not walk into the redirect
again.

- [x] **Step 3: Implement the layouts**

`frontend/src/components/layout/AppLayout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { useSession } from '@/features/auth/useSession';

export function AppLayout({ children }: { children?: ReactNode }) {
  const { user } = useSession();

  return (
    <>
      <TopBar userName={user?.name ?? ''} />
      {/* An <Outlet /> when used as a layout route, explicit children when the
          root route renders it directly — `/` cannot be a layout route,
          because it is the one path that serves two different screens. */}
      {children ?? <Outlet />}
    </>
  );
}
```

`frontend/src/features/auth/AuthLayout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

/** The public shell: the logo above a centered card on gray-100. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <p className="mb-6 text-2xl font-bold text-brand-base">Financy</p>
      <Card className="w-full max-w-md p-8">{children}</Card>
    </main>
  );
}
```

- [x] **Step 4: Handle the empty name in TopBar**

In `frontend/src/components/layout/TopBar.tsx`, the avatar link's label is
built by interpolation and reads "Perfil de " while `me` is in flight. Change it
to fall back:

```tsx
        <Link
          to="/profile"
          aria-label={userName ? `Perfil de ${userName}` : 'Perfil'}
        >
```

`Avatar` already renders an empty circle for an empty name, so no change is
needed there. Add a TopBar test asserting the fallback label.

- [x] **Step 5: Rewrite the routes**

`frontend/src/routes.tsx`:

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAnonymous } from '@/components/layout/RequireAnonymous';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { PageShell } from '@/components/layout/PageShell';
import { StyleGuide } from '@/pages/StyleGuide';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { useSession } from '@/features/auth/useSession';

// Placeholders that slices 2 through 5 replace, each named for the page it
// will become.
function Placeholder({ title }: { title: string }) {
  return (
    <PageShell title={title} subtitle="Em construção">
      <p className="text-sm text-gray-500">
        Esta página chega em uma fatia futura.
      </p>
    </PageShell>
  );
}

/**
 * One path, two screens, as the requirements specify. This is the only route
 * that decides for itself rather than sitting behind a guard: declaring `/`
 * twice with opposite guards would make each redirect to the other, and the
 * loop only appears once somebody is actually signed in.
 */
function RootRoute() {
  const { token } = useSession();

  if (!token) return <LoginPage />;

  return (
    <AppLayout>
      <Placeholder title="Dashboard" />
    </AppLayout>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/transactions" element={<Placeholder title="Transações" />} />
          <Route path="/categories" element={<Placeholder title="Categorias" />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<RequireAnonymous />}>
        <Route path="/signup" element={<SignUpPage />} />
      </Route>

      <Route path="/style-guide" element={<StyleGuide />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

Every private route sits behind `RequireAuth`, sign up sits behind
`RequireAnonymous`, and both redirect to `/`, which always has an answer.

Slice 0's "Página não encontrada" placeholder is dropped in favour of a
redirect. It was the one path where a signed-out visitor still rendered an
application page.

- [x] **Step 6: Run the tests**

Run: `npm test -w @financy/frontend -- routes`
Expected: the two guard-redirect tests pass; the login and sign up heading
assertions fail until tasks 13 and 14. Everything else in the suite stays green.

- [x] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat(frontend): guard the private routes and split the root

The root route decides for itself instead of being declared twice with
opposite guards. Two such routes redirect to each other, and the loop
only appears once someone is actually signed in.

routes.test.tsx's login and sign up assertions stay red until the next
two tasks build those screens."
```

---

### Task 13: The login page

**Files:**
- Create: `frontend/src/features/auth/LoginPage.tsx`
- Create: `frontend/src/features/auth/validation.ts`
- Create: `frontend/src/lib/graphql-errors.ts`
- Test: `frontend/src/features/auth/LoginPage.test.tsx`
- Test: `frontend/src/lib/graphql-errors.test.ts`

**Interfaces:**
- Consumes: `useSignInMutation`, `useSession`, `AuthLayout`, `Input`, `PasswordInput`, `Checkbox`, `Button`, `TextLink`.
- Produces: `LoginPage`; `signInSchema` and `signUpSchema` from `src/features/auth/validation.ts`; `errorCodeOf(error): string | null` and `fieldErrorsOf(error): Record<string, string[]>` from `src/lib/graphql-errors.ts`.

- [x] **Step 1: Install the form libraries**

```bash
npm install -w @financy/frontend react-hook-form @hookform/resolvers
```

- [x] **Step 2: Write the error reader and its test**

`frontend/src/lib/graphql-errors.test.ts` covers a `ClientError` carrying a
code, a `ClientError` with no extensions, a plain `Error`, and `undefined` —
each returning `null` rather than throwing. An error reader that throws while
reading an error turns a handled failure into a blank screen.

`frontend/src/lib/graphql-errors.ts`:

```ts
import { ClientError } from 'graphql-request';

/** The `extensions.code` of the first error, or null if there is not one. */
export function errorCodeOf(error: unknown): string | null {
  if (!(error instanceof ClientError)) return null;
  const code = error.response.errors?.[0]?.extensions?.code;
  return typeof code === 'string' ? code : null;
}

/** Server-side field errors, keyed by field name. Empty when there are none. */
export function fieldErrorsOf(error: unknown): Record<string, string[]> {
  if (!(error instanceof ClientError)) return {};
  const fieldErrors = error.response.errors?.[0]?.extensions?.fieldErrors;
  return typeof fieldErrors === 'object' && fieldErrors !== null
    ? (fieldErrors as Record<string, string[]>)
    : {};
}
```

- [x] **Step 3: Write the validation schemas**

`frontend/src/features/auth/validation.ts`:

```ts
import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  // No minimum length. It mirrors the backend, which does not apply today's
  // policy to an existing account, and telling someone their password is too
  // short before checking it is feedback about the wrong thing.
  password: z.string().min(1, 'Informe sua senha'),
  remember: z.boolean(),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe seu nome')
    .max(100, 'O nome deve ter no máximo 100 caracteres'),
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
```

These mirror `backend.md` section 7 field for field, per `frontend.md` section 8.
Client validation is for feedback speed; the server decides what is stored.

- [x] **Step 4: Write the failing page test**

`frontend/src/features/auth/LoginPage.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { AppRoutes } from '@/routes';

async function fillAndSubmit(
  email = 'ana@exemplo.com',
  password = 'uma-senha-boa',
) {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  it('signs in and lands on the dashboard', async () => {
    server.use(
      api.mutation('SignIn', () =>
        ok({ signIn: { token: 'novo-token', user: aUser } }),
      ),
      api.query('Me', () => ok({ me: aUser })),
    );

    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit();

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });

  it('stores the token in localStorage when Lembrar-me is checked', async () => {
    server.use(
      api.mutation('SignIn', () =>
        ok({ signIn: { token: 'novo-token', user: aUser } }),
      ),
      api.query('Me', () => ok({ me: aUser })),
    );

    renderWithProviders(<AppRoutes />, { route: '/' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lembrar-me' }));
    await fillAndSubmit();

    await waitFor(() =>
      expect(localStorage.getItem('financy.token')).toBe('novo-token'),
    );
    expect(sessionStorage.getItem('financy.token')).toBeNull();
  });

  it('stores the token in sessionStorage when it is not checked', async () => {
    server.use(
      api.mutation('SignIn', () =>
        ok({ signIn: { token: 'novo-token', user: aUser } }),
      ),
      api.query('Me', () => ok({ me: aUser })),
    );

    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit();

    await waitFor(() =>
      expect(sessionStorage.getItem('financy.token')).toBe('novo-token'),
    );
    expect(localStorage.getItem('financy.token')).toBeNull();
  });

  it('renders INVALID_CREDENTIALS as a form-level error', async () => {
    server.use(
      api.mutation('SignIn', () =>
        graphqlError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos'),
      ),
    );

    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha incorretos',
    );
    // Not attached to a field: saying which one is wrong tells an attacker
    // which addresses have accounts.
    expect(screen.getByLabelText('E-mail')).not.toHaveAccessibleDescription(
      /incorret/i,
    );
    expect(screen.getByRole('heading', { name: 'Fazer login' })).toBeInTheDocument();
  });

  it('validates the email before sending anything', async () => {
    // No SignIn handler. onUnhandledRequest is 'error', so a request here
    // fails the test — which is the assertion.
    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit('nao-e-um-email');

    expect(await screen.findByText('Informe um e-mail válido')).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      api.mutation('SignIn', async () => {
        await held;
        return ok({ signIn: { token: 'novo-token', user: aUser } });
      }),
      api.query('Me', () => ok({ me: aUser })),
    );

    renderWithProviders(<AppRoutes />, { route: '/' });
    await fillAndSubmit();

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeDisabled();
    release();
  });

  it('does not render a password recovery link', () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    expect(screen.queryByText(/recuperar senha/i)).not.toBeInTheDocument();
  });

  it('links to the sign up page', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    await userEvent.click(screen.getByRole('link', { name: 'Criar conta' }));

    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument();
  });
});
```

The recovery-link test exists because the link is in the Figma frame. Without an
assertion, someone building from the design adds it back and a locked-out user
clicks a link to nothing. `frontend.md` section 12 records the decision; this
test enforces it.

- [x] **Step 5: Run the test to verify it fails**

Run: `npm test -w @financy/frontend -- LoginPage`
Expected: FAIL — cannot resolve `./LoginPage`.

- [x] **Step 6: Implement the page**

`frontend/src/features/auth/LoginPage.tsx` — the structure, with the
details left to the implementer's judgement against the design:

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextLink } from '@/components/ui/TextLink';
import { useSignInMutation } from '@/graphql/generated/graphql';
import { errorCodeOf } from '@/lib/graphql-errors';
import { AuthLayout } from './AuthLayout';
import { useSession } from './useSession';
import { signInSchema, type SignInValues } from './validation';

export function LoginPage() {
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const signInMutation = useSignInMutation();

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const data = await signInMutation.mutateAsync({
        input: { email: values.email, password: values.password },
      });
      signIn(data.signIn.token, data.signIn.user, values.remember);
    } catch (error) {
      // Every failure here renders at form level. INVALID_CREDENTIALS covers
      // both an unknown email and a wrong password by design, and attaching it
      // to the email field would undo that.
      setFormError(
        errorCodeOf(error) === 'INVALID_CREDENTIALS'
          ? 'E-mail ou senha incorretos'
          : 'Não foi possível entrar. Tente novamente.',
      );
    }
  });

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-gray-800">Fazer login</h1>
      <p className="mt-1 text-sm text-gray-500">
        Entre na sua conta para continuar
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark"
          >
            {formError}
          </p>
        )}

        <Input
          label="E-mail"
          type="email"
          icon={Mail}
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />

        <PasswordInput
          label="Senha"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        <Checkbox label="Lembrar-me" {...form.register('remember')} />

        <Button type="submit" disabled={signInMutation.isPending}>
          Entrar
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        ou
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <TextLink to="/signup">Criar conta</TextLink>
    </AuthLayout>
  );
}
```

`noValidate` on the form: the browser's own validation bubble would fire before
zod and show an English message in a Portuguese interface.

The design draws "Criar conta" as a secondary button. Rendering it as a
`TextLink` keeps it a real link — right-clickable, middle-clickable, and
announced as navigation rather than as an action. Style it to match the
secondary button; if the owner's Figma comparison rejects that, switch to
`Button` wrapping a `Link` and record the decision.

- [x] **Step 7: Run the tests**

Run: `npm test -w @financy/frontend`
Expected: PASS — the login suite, and `routes.test.tsx`'s login assertions now
green.

- [x] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add the login page

INVALID_CREDENTIALS renders at form level, never on the email field.
Attaching it to a field would tell an attacker which addresses have
accounts, which is exactly what the single backend error code exists
to prevent."
```

---

### Task 14: The sign up page

**Files:**
- Create: `frontend/src/features/auth/SignUpPage.tsx`
- Test: `frontend/src/features/auth/SignUpPage.test.tsx`

**Interfaces:**
- Consumes: `useSignUpMutation`, `useSession`, `AuthLayout`, the same primitives and `signUpSchema`.
- Produces: `SignUpPage`.

- [x] **Step 1: Write the failing test**

`frontend/src/features/auth/SignUpPage.test.tsx` covers:

- Filling name, email and password and submitting lands on the dashboard, signed
  in with the returned token — `frontend.md` section 5 says the user is signed
  in immediately rather than being sent to the login form.
- `EMAIL_ALREADY_EXISTS` renders **on the email field**, via
  `toHaveAccessibleDescription`. This is the opposite of login on purpose: at
  sign-up the address is being claimed, so telling the user it is taken is the
  only useful thing to say, and it reveals nothing they did not just assert.
- The password helper "A senha deve ter no mínimo 8 caracteres" is visible
  before the user types anything, not only after a failure.
- A seven-character password shows the client-side message and fires no request
  (no handler registered; `onUnhandledRequest: 'error'` is the assertion).
- A name over 100 characters is rejected.
- The submit button is disabled while the mutation is in flight.
- "Fazer login" navigates back to `/`.
- Signing up stores the token — `sessionStorage`, since this form has no
  "Lembrar-me" and the design does not draw one.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -w @financy/frontend -- SignUpPage`
Expected: FAIL — cannot resolve `./SignUpPage`.

- [x] **Step 3: Implement the page**

Same shape as `LoginPage`: `AuthLayout`, heading "Criar conta", subtitle
"Comece a controlar suas finanças ainda hoje", a name `Input`, an email `Input`,
a `PasswordInput` carrying `helperText="A senha deve ter no mínimo 8 caracteres"`,
a submit `Button`, the "ou" divider and a "Fazer login" link to `/`.

The one structural difference is error handling:

```tsx
    } catch (error) {
      if (errorCodeOf(error) === 'EMAIL_ALREADY_EXISTS') {
        form.setError('email', {
          message: 'Este e-mail já está em uso',
        });
        return;
      }

      // Anything the server named a field for goes onto that field; the rest
      // is a form-level message. frontend.md section 8.
      const fieldErrors = fieldErrorsOf(error);
      const named = Object.entries(fieldErrors);
      if (named.length > 0) {
        for (const [field, messages] of named) {
          if (field in form.getValues() && messages[0]) {
            form.setError(field as keyof SignUpValues, { message: messages[0] });
          }
        }
        return;
      }

      setFormError('Não foi possível criar a conta. Tente novamente.');
    }
```

On success:

```tsx
      signIn(data.signUp.token, data.signUp.user, false);
```

`remember: false`. There is no checkbox on this form, and defaulting a brand new
account to a token that survives the browser closing is a decision the user did
not make. They can choose it on their next login.

- [x] **Step 4: Run the tests**

Run: `npm test -w @financy/frontend`
Expected: PASS — the sign up suite, and `routes.test.tsx` fully green for the
first time.

- [x] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add the sign up page

EMAIL_ALREADY_EXISTS lands on the email field, unlike login's error at
form level. At sign-up the address is being claimed, so naming it says
nothing the user did not just assert."
```

---

### Task 15: The profile page and signing out

The only screen the design gives a sign-out control, which is why `roadmap.md`
puts it in this slice rather than a later one.

**Files:**
- Create: `frontend/src/features/profile/ProfilePage.tsx`
- Test: `frontend/src/features/profile/ProfilePage.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `useUpdateProfileMutation`, `useMeQuery`, `Avatar`, `Card`, `Input`, `Button`, `PageShell`.
- Produces: `ProfilePage`.

- [x] **Step 1: Write the failing test**

`frontend/src/features/profile/ProfilePage.test.tsx` covers:

- The name field is prefilled from `me`, and the email field shows the address,
  is `disabled`, and carries the helper "O e-mail não pode ser alterado".
- Editing the name and clicking "Salvar alterações" sends `updateProfile` and
  the new name appears in the top bar — which is the observable proof that the
  `Me` query was invalidated rather than only the form state changing.
- A `BAD_USER_INPUT` response with a `fieldErrors.name` renders on the name
  field.
- An empty name is rejected client-side with no request sent.
- The submit button is disabled while the mutation is in flight.
- "Sair da conta" clears both storages, empties the query cache, and lands on
  the login screen.
- While `me` is loading, the page renders a skeleton rather than an empty form —
  `frontend.md` section 10 requires the loading state, and a form that starts
  empty and then fills in loses whatever the user typed in between.

The sign-out assertion checks `queryClient.getQueryCache().getAll()` is empty,
for the reason `frontend.md` section 5 gives: without it the next user on the
same browser sees the previous user's data render from cache.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -w @financy/frontend -- ProfilePage`
Expected: FAIL — cannot resolve `./ProfilePage`.

- [x] **Step 3: Implement the page**

Structure: `PageShell` titled "Perfil", a centered `Card` holding a large
`Avatar`, the name and email as text, then the form — a "Nome completo" `Input`,
a disabled email `Input` with the helper, a primary "Salvar alterações" `Button`
and a secondary "Sair da conta" `Button` with `icon={LogOut}` in the danger
color.

Three things worth being explicit about:

```tsx
  const { user, isLoadingUser, signOut } = useSession();
  const queryClient = useQueryClient();

  const updateProfile = useUpdateProfileMutation({
    onSuccess: async () => {
      // The top bar and this page both read the current user from Me. Without
      // this the name updates in the form and stays stale everywhere else.
      await queryClient.invalidateQueries({ queryKey: useMeQuery.getKey() });
      setStatus('Alterações salvas');
    },
  });
```

The form is keyed on the loaded user so React Hook Form's `defaultValues` are
set once the data exists, rather than initialised empty:

```tsx
  if (isLoadingUser || !user) return <ProfileSkeleton />;

  return <ProfileForm key={user.id} user={user} />;
```

Success feedback is an inline message with `role="status"`, not a toast:

```tsx
        {status && (
          <p role="status" className="text-sm text-success">
            {status}
          </p>
        )}
```

`frontend.md` section 10 specifies toasts for mutation results. This slice does
not build a toast system: login and sign up give their feedback by navigating,
and profile is the one operation left. A toast component belongs with slice 2's
destructive confirmations and list mutations, where three more operations need
it and the shape of what it has to carry is actually known. Task 17 records
this in the spec as a deliberate, temporary deviation.

- [x] **Step 4: Run the tests**

Run: `npm test -w @financy/frontend`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add the profile page and sign out

Sign out empties the query cache rather than invalidating it. An
invalidated cache still renders its stale data while refetching, which
means the next user on this browser briefly sees the previous one's."
```

---

### Task 16: Expired sessions

`frontend.md` section 6: when the API answers `UNAUTHENTICATED`, the client
clears the token and the cache and returns the user to login. Task 11 handles
that for the `Me` query specifically. This generalizes it to every request, which
is what slices 2 through 5 rely on.

**Files:**
- Create: `frontend/src/lib/unauthenticated.ts`
- Modify: `frontend/src/lib/graphql-client.ts`
- Modify: `frontend/src/features/auth/SessionContext.tsx`
- Test: `frontend/src/lib/unauthenticated.test.ts`
- Test: `frontend/src/features/auth/expired-session.test.tsx`

**Interfaces:**
- Consumes: `graphqlClient`.
- Produces: `onUnauthenticated(listener): () => void` and `notifyUnauthenticated(): void` from `src/lib/unauthenticated.ts`.

- [x] **Step 1: Write the notifier**

`frontend/src/lib/unauthenticated.ts`:

```ts
type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribes to expired-session events. Returns an unsubscribe function. */
export function onUnauthenticated(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyUnauthenticated(): void {
  for (const listener of listeners) listener();
}
```

A module-level event rather than a React context: the client is created outside
the component tree and must not import from it, and the session provider is the
only subscriber.

Its test covers subscribe, notify, unsubscribe, and notifying with no listeners
registered — which happens on the very first request of a page load and must not
throw.

- [x] **Step 2: Detect the code in the client**

In `frontend/src/lib/graphql-client.ts`, construct the client with a
response middleware:

```ts
export const graphqlClient = new GraphQLClient(env.VITE_BACKEND_URL, {
  responseMiddleware: (response) => {
    const errors =
      response instanceof Error
        ? (response as ClientError).response?.errors
        : response.errors;

    if (errors?.some((error) => error.extensions?.code === 'UNAUTHENTICATED')) {
      notifyUnauthenticated();
    }
  },
});
```

One place, so every operation in every later slice is covered without each one
remembering. `signIn` cannot trigger it: a failed sign-in is
`INVALID_CREDENTIALS`, a different code.

- [x] **Step 3: Subscribe in the session provider**

In `SessionProvider`, replace the `meQuery.isError` effect from task 11 with a
subscription, which covers the same case and every other one:

```tsx
  useEffect(() => onUnauthenticated(() => {
    if (readToken()) signOut();
  }), [signOut]);
```

The `readToken()` guard stops a redundant `signOut` — and the cache clear it
carries — from running when there was no session to begin with.

Keep the `meQuery.isError` handling for one case the notifier does not cover:
`NOT_FOUND`, returned when a valid token names a user who has been deleted. That
is also a dead session.

- [x] **Step 4: Write the integration test**

`frontend/src/features/auth/expired-session.test.tsx`:

- Start signed in with a stored token and a working `Me`.
- Navigate to `/profile`, then make `UpdateProfile` answer `UNAUTHENTICATED`.
- Submit, and assert: the token is gone from both storages, the query cache is
  empty, and the login heading is on screen.

This is the case a user actually hits — a tab left open past the seventh day —
and the failure mode without it is a screen of broken panels with no way out but
a manual reload.

- [x] **Step 5: Run the tests**

Run: `npm test -w @financy/frontend`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat(frontend): return to login when a session expires

Detected once in the client's response middleware rather than in each
hook, so every operation added by later slices is covered without
each one remembering to handle it."
```

---

### Task 17: Slice verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/specs/frontend.md`
- Modify: `docs/specs/backend.md`

- [x] **Step 1: Run everything**

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run codegen:check -w @financy/backend
npm run codegen:check -w @financy/frontend
```

Expected: all pass, and both `codegen:check` runs report no diff. A diff there
means a generated file was committed stale.

Run these through `rtk proxy "<command>"` if the RTK hook is active. A filtered
run can report a pass for a command that failed, and every claim below rests on
these outputs.

- [x] **Step 2: Verify both applications together**

Terminal one: `npm run dev:backend`. Terminal two: `npm run dev:frontend`.

Then, by hand in the browser:

1. At `http://localhost:5173/`, the login screen renders with no top bar.
2. Create an account at `/signup`; land on the dashboard placeholder with the
   top bar and the avatar showing the right initials.
3. Reload. The session survives.
4. Go to `/profile`, change the name, save. The top bar updates.
5. Sign out. The login screen returns, and `localStorage` and `sessionStorage`
   hold no `financy.token` (check in the console).
6. Sign in again with "Lembrar-me" unchecked, then close the tab and reopen
   `http://localhost:5173/`. The login screen is shown, not the dashboard.
7. Sign in with "Lembrar-me" checked and repeat: the dashboard is shown.
8. With no session, navigate directly to `/transactions`. It redirects to the
   login screen.

Step 6 is the one that fails silently if `writeToken` does not clear both
stores. It is worth doing by hand even though a test covers it, because the
test uses a jsdom storage that a real browser's tab lifecycle does not.

- [x] **Step 3: Update the specs**

Three edits, all required by the definition of done:

1. `docs/specs/backend.md`, section 3: change the module file list from
   `schema.graphql, resolvers.ts, service.ts, validation.ts` to
   `schema.ts, resolvers.ts, service.ts, validation.ts`, and add a sentence
   saying the SDL is a `/* GraphQL */`-tagged template literal so no build step
   copies non-TypeScript files into `dist`. Add `password.ts` and `jwt.ts` to
   the `shared/` list, and `graphql/generated/` and `schema.graphql` to the
   tree.
2. `docs/specs/frontend.md`, section 3: the `Checkbox` row added in task 9 —
   confirm it is there.
3. `docs/specs/frontend.md`, section 12: add a deviation entry:

   > **Mutation feedback on the profile screen is inline, not a toast.**
   > Section 10 specifies toasts. Slice 1's other two mutations give their
   > feedback by navigating, leaving one operation to justify a toast system.
   > The profile form renders a `role="status"` message instead. Slice 2, which
   > adds three mutations and two destructive confirmations, builds the toast
   > component and this entry is removed then.

Also change both specs' `Status:` line from "approved, not implemented" to
"approved, implemented through slice 1".

- [x] **Step 4: Update the README**

In `README.md`'s Status section: change the summary line to "Slice 1 of 5
complete: a person can create an account, sign in, edit their profile and sign
out." with the same link to the roadmap, and check the
`[ ] Slice 1 — Auth and profile` box.

- [x] **Step 5: Write the Figma handoff checklist**

The agent has no Figma access. Produce a checklist for the repository owner
naming each thing to compare side by side with the Pages tab:

- Login: card width and padding, the field spacing, the "ou" divider, the
  "Criar conta" treatment (the plan renders it as a link styled like a
  secondary button — confirm or correct).
- Sign up: the same, plus the password helper text position.
- Profile: avatar size, the disabled email field's fill and text color, the
  "Sair da conta" button's danger icon.
- Checkbox: box size, border radius, checked fill color, focus ring.
- The top bar with a real name in it, against the signed-in frames.

Carry forward the two checks slice 0 handed over and that are still open: the
sixteen `CategoryIcon` names against the Style Guide, and the `/style-guide`
primitive comparison. Both block slice 2, which is the first slice to render
category icons.

- [x] **Step 6: Commit**

```bash
git add README.md docs/specs
git commit -m "docs: record slice 1 in the README and correct both specs

backend.md described module SDL as schema.graphql; it is a tagged
template literal in schema.ts, so no build step has to copy
non-TypeScript files into dist."
```

---

## Slice completion checklist

Before opening the pull request, confirm every line of the definition of done in
[`roadmap.md`](./roadmap.md), plus:

- [x] `npm test` passes in both workspaces.
- [x] `npm run typecheck` passes in both workspaces.
- [x] `npm run lint` and `npm run format:check` pass at the root.
- [x] `npm run codegen:check` reports no diff in either workspace.
- [x] `backend/prisma/migrations/` is committed, and no `.db` file is.
- [x] No new environment variable was introduced. If one was, it is in the
      matching `.env.example`.
- [x] Every auth operation has a success test, a validation-failure test and an
      unauthenticated test, and one user's write is proven not to reach
      another's row.
- [x] Sign-in returns the same error for an unknown email and a wrong password,
      and a test asserts the messages are identical.
- [x] The login screen renders no password recovery link, and a test asserts it.
- [x] Sign out clears both storages and empties the query cache.
- [ ] The manual walkthrough in task 17 step 2 was completed, including step 6.
- [ ] The Figma handoff checklist was given to the repository owner, and the
      reported differences were corrected.
- [ ] Slice 0's two open Figma checks — the sixteen icon names and the
      `/style-guide` comparison — were resolved, or explicitly carried into
      slice 2 with the owner's agreement.

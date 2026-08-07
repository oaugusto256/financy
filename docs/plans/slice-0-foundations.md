# Slice 0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Both applications start, are typed, are tested, and the frontend design system exists in full, so every later slice is assembly rather than invention.

**Architecture:** An npm-workspaces monorepo. The backend is Apollo Server 4 behind Express, with Prisma over SQLite and zod-validated environment variables. The frontend is Vite + React + Tailwind, with the design tokens from the Figma Style Guide expressed as Tailwind theme values and the component primitives built and tested before any page uses them.

**Tech Stack:** TypeScript, Apollo Server 4, Express 4, Prisma 6, SQLite, zod 4, Vite, React 19, React Router, Tailwind CSS v4, lucide-react, Vitest, Testing Library, ESLint 9, Prettier.

## Global Constraints

- Node 20 or newer. npm workspaces; no pnpm or yarn.

### Pinned majors

Three dependencies are pinned rather than taken at `latest`, because the current
major breaks what this plan describes. Each pin is a decision to revisit, not a
permanent choice.

| Package | Pin | Why |
|---|---|---|
| `prisma`, `@prisma/client` | `^6` | Prisma 7 rejects `url` inside `datasource db` (`P1012`) and drops the `prisma-client-js` generator. It requires a `prisma.config.ts` and a driver adapter passed to `PrismaClient`. Migrating is a slice of its own. |
| `@apollo/server` | `^4` | Apollo Server 5 removed the `./express4` export; the integration moved to `@as-integrations/express4`/`express5`. |
| `express`, `@types/express` | `^4` | Required by `@apollo/server/express4`. |

Pinning Apollo to 4 carries one known cost. `npm audit` reports a moderate
advisory against `uuid` (`GHSA-w5hq-g745-h8pq`, a missing buffer bounds check in
`v3`/`v5`/`v6` when an explicit `buf` is passed) reached through
`@apollo/server@4`, and the only offered remedy is the upgrade to 5. The
vulnerable path is not reachable from Apollo's use of the library, which calls
`v4` without a buffer, so this is not a slice 0 blocker — but it is the concrete
reason the Apollo pin should be revisited rather than left indefinitely.

`zod` is **not** pinned — it installs at 4.x. Note that zod 4 silently ignores
the v3 `required_error` option, so error messages are set with `.min(1, '…')` or
the v4 `error` option instead.
- TypeScript everywhere, `strict: true`. No `any` introduced.
- Tailwind CSS v4, configured CSS-first with `@theme`. If the installed major is 3.x, the same tokens go in `tailwind.config.ts` instead.
- All colors come from `frontend.md` section 3 verbatim. No color literal appears outside the theme definition.
- Font: Inter, self-hosted via `@fontsource/inter`. No runtime request to Google Fonts.
- Icons: `lucide-react` only.
- Interface language is Brazilian Portuguese. Code, comments and commits are in English.
- Every environment variable added must appear in the matching `.env.example` in the same commit.
- Conventional Commits. One commit per task.
- Figma comparison is performed by the repository owner, not by the agent
  executing this plan. Where a step says to check against the Style Guide, the
  agent produces an explicit checklist and the owner confirms or corrects it
  before the pull request is opened.

---

### Task 0: Lint and format toolchain

`roadmap.md`'s definition of done requires that lint passes, and no task
established a linter. This one does, before any source file exists, so every
later task lands already clean rather than accumulating a cleanup commit.

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run lint` and `npm run format:check` at the workspace root.

- [x] **Step 1: Install the toolchain at the root**

```bash
npm install -D -w . eslint @eslint/js typescript-eslint prettier \
  eslint-config-prettier eslint-plugin-react-hooks eslint-plugin-react-refresh \
  globals
```

The config lives at the root rather than one per workspace. Two configs drift,
and the rules that matter here are the same on both sides.

- [x] **Step 2: Write the flat config**

`eslint.config.mjs` — one shared base, with the browser globals and React hooks
rules scoped to the frontend and Node globals scoped to the backend.

- [x] **Step 3: Write the Prettier config**

`.prettierrc.json`: single quotes, trailing commas, 80 columns — matching the
formatting every code block in this plan is already written in.

`.prettierignore` excludes `*.md`. The specs and plans are prose wrapped by hand
at 80 columns, and Prettier reflows markdown paragraphs — letting it near them
would rewrite every document the first time one line changed.

- [x] **Step 4: Add the scripts**

In the root `package.json`:

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [x] **Step 5: Verify**

Run: `npm run lint` and `npm run format:check`
Expected: both pass on an empty tree.

- [x] **Step 6: Commit**

```bash
git add package.json eslint.config.js .prettierrc.json .prettierignore
git commit -m "chore: add the lint and format toolchain

The definition of done requires that lint passes and nothing
established a linter. Adding it before the first source file means
every later task lands clean instead of ending in a cleanup commit."
```

---

### Task 1: Monorepo and backend bootstrap with validated environment

**Files:**
- Create: `package.json`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/shared/env.ts`
- Create: `backend/.env.example`
- Create: `backend/.env`
- Test: `backend/tests/unit/env.test.ts`
- Delete: `backend/.gitkeep`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseEnv(raw: Record<string, string | undefined>): Env` and the eagerly-evaluated `env: Env`, both from `src/shared/env.ts`. `Env` is `{ DATABASE_URL: string; JWT_SECRET: string; PORT: number; CORS_ORIGIN: string; NODE_ENV: 'development' | 'test' | 'production' }`.

- [x] **Step 1: Create the workspace root**

`package.json`:

```json
{
  "name": "financy",
  "private": true,
  "workspaces": ["backend, frontend"],
  "engines": { "node": ">=20" },
  "scripts": {
    "dev:backend": "npm run dev --workspace backend",
    "dev:frontend": "npm run dev --workspace frontend",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

- [x] **Step 2: Create the backend package**

`backend/package.json`:

```json
{
  "name": "@financy/backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file-if-exists=.env src/server.ts",
    "build": "tsc",
    "start": "node dist/src/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

`tsx` does not read `.env` on its own, and `src/shared/env.ts` parses
`process.env` at import — so without the flag the dev server dies before it
binds a port. `--env-file-if-exists` rather than `--env-file` so that a missing
file falls through to `parseEnv`'s named-variable message instead of a Node
file-not-found error. Only `dev` needs it; in production the values come from
the environment rather than from a file.

Then install:

```bash
npm install -w @financy/backend zod
npm install -w @financy/backend -D typescript tsx vitest @types/node
```

- [x] **Step 3: Configure TypeScript and Vitest**

`backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

`rootDir` is `.` rather than `src` so that `tests/` is type-checked too. That
puts the compiled entry point at `dist/src/server.js`, which is why the `start`
script above points there.

`backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret',
      PORT: '4000',
      CORS_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'test',
    },
  },
});
```

`fileParallelism` is off because later slices share one SQLite test database; parallel files would reset it under each other.

The `env` block is required, not optional. `src/shared/env.ts` parses
`process.env` at module load, and Vitest does not read `backend/.env` into
`process.env` — so without it, importing anything that reaches `env.ts` throws
before a single test runs. Declaring the values here rather than pointing Vitest
at `.env` also keeps the suite green on a fresh clone, where `.env` is
gitignored and absent. `DATABASE_URL` points at `test.db`, not `dev.db`, so the
integration tests of later slices never reset the development database.

- [x] **Step 4: Write the failing test**

`backend/tests/unit/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/shared/env.js';

const valid = {
  DATABASE_URL: 'file:./dev.db',
  JWT_SECRET: 'a-secret-long-enough',
  PORT: '4000',
  CORS_ORIGIN: 'http://localhost:5173',
  NODE_ENV: 'development',
};

describe('parseEnv', () => {
  it('parses a valid environment', () => {
    expect(parseEnv(valid)).toEqual({
      DATABASE_URL: 'file:./dev.db',
      JWT_SECRET: 'a-secret-long-enough',
      PORT: 4000,
      CORS_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'development',
    });
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv(valid).PORT).toBe(4000);
  });

  it('defaults PORT and NODE_ENV when absent', () => {
    const { PORT, ...rest } = valid;
    const parsed = parseEnv({ ...rest, NODE_ENV: undefined });
    expect(parsed.PORT).toBe(4000);
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: undefined })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('throws when JWT_SECRET is empty', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
  });
});
```

The empty-secret case is not redundant with the missing case. A `.env` file
containing `JWT_SECRET=` yields an empty string, not `undefined`, and that is
the realistic way a server ends up signing tokens anyone can forge.

- [x] **Step 5: Run the test to verify it fails**

Run: `npm test -w @financy/backend`
Expected: FAIL — cannot resolve `../../src/shared/env.js`.

- [x] **Step 6: Implement the environment module**

`backend/src/shared/env.ts`:

```ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

export const env = parseEnv(process.env);
```

Parsing at module load means a misconfigured server dies at startup with a
readable message instead of failing on the first request that happens to need
the missing value.

- [x] **Step 7: Run the test to verify it passes**

Run: `npm test -w @financy/backend`
Expected: PASS — 6 tests.

- [x] **Step 8: Write the environment files**

`backend/.env.example`:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET=
PORT=4000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

`backend/.env` — same keys, with `JWT_SECRET` filled in for local use:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET=local-development-secret-not-for-production
PORT=4000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

`.env` is already ignored by the root `.gitignore`. Confirm with
`git check-ignore backend/.env` before committing — it must print the path.

- [x] **Step 9: Commit**

```bash
rm backend/.gitkeep
git add package.json backend
git commit -m "feat(backend): bootstrap workspace with validated environment

A server that boots with an empty JWT_SECRET signs tokens anyone can
forge, and does it silently. Parsing the environment at module load
turns that into a startup failure with a readable message."
```

---

### Task 2: Prisma over SQLite

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/shared/prisma.ts`
- Test: `backend/tests/integration/prisma.test.ts`

**Interfaces:**
- Consumes: `env` from `src/shared/env.ts`.
- Produces: `prisma: PrismaClient`, the single client instance, from `src/shared/prisma.ts`.

- [x] **Step 1: Install Prisma**

```bash
npm install -w @financy/backend @prisma/client@6
npm install -w @financy/backend -D prisma@6
```

Pinned to 6. Prisma 7 fails this schema with `P1012` — it no longer accepts
`url` inside `datasource db`, and wants a `prisma.config.ts` plus a driver
adapter handed to the `PrismaClient` constructor instead.

- [x] **Step 2: Write the Prisma schema**

`backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

No models yet. Each feature slice adds its own model with its own migration, so
every migration is reviewable next to the code that uses it.

- [x] **Step 3: Generate the client**

Run: `npx prisma generate --schema backend/prisma/schema.prisma`
Expected: "Generated Prisma Client".

Add to `backend/package.json` scripts:

```json
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:reset": "prisma migrate reset --force"
```

- [x] **Step 4: Write the failing test**

`backend/tests/integration/prisma.test.ts`:

```ts
import { afterAll, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';

afterAll(async () => {
  await prisma.$disconnect();
});

it('connects to the database', async () => {
  const result = await prisma.$queryRaw`SELECT 1 as value`;
  // BigInt, not number: $queryRaw hands back SQLite integers untouched rather
  // than narrowing them to JavaScript's safe range.
  expect(result).toEqual([{ value: 1n }]);
});
```

- [x] **Step 5: Run the test to verify it fails**

Run: `npm test -w @financy/backend`
Expected: FAIL — cannot resolve `../../src/shared/prisma.js`.

- [x] **Step 6: Implement the client module**

`backend/src/shared/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
```

One client for the whole process. Prisma holds a connection pool, so creating a
client per request would open connections faster than it closes them.

- [x] **Step 7: Run the test to verify it passes**

Run: `npm test -w @financy/backend`
Expected: PASS — the raw query returns `[{ value: 1n }]`.

- [x] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(backend): wire Prisma over SQLite

Schema carries no models yet. Each feature slice adds its own model
and migration, so a migration is always reviewed beside the code
that needs it."
```

---

### Task 3: Apollo Server behind Express, with CORS and a health query

**Files:**
- Create: `backend/src/schema.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Test: `backend/tests/integration/health.test.ts`

**Interfaces:**
- Consumes: `env` from `src/shared/env.ts`.
- Produces: `typeDefs: string` and `resolvers` from `src/schema.ts`; `createApp(): Promise<{ app: Express; apollo: ApolloServer }>` from `src/app.ts`. Later slices extend `typeDefs` and `resolvers` rather than replacing them.

- [x] **Step 1: Install the server dependencies**

```bash
npm install -w @financy/backend @apollo/server@4 express@4 cors graphql
npm install -w @financy/backend -D @types/express@4 @types/cors supertest @types/supertest
```

Apollo Server 4, not 5: version 5 removed the `./express4` subpath export and
moved the integration out to `@as-integrations/express4`. Express 4 follows from
that, since `@apollo/server/express4` is what the pinned major ships.

- [x] **Step 2: Write the failing test**

`backend/tests/integration/health.test.ts`:

```ts
import request from 'supertest';
import { beforeAll, afterAll, expect, describe, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import type { ApolloServer } from '@apollo/server';

let app: Express;
let apollo: ApolloServer;

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

afterAll(async () => {
  await apollo.stop();
});

describe('the GraphQL endpoint', () => {
  it('answers the health query', async () => {
    const response = await request(app)
      .post('/graphql')
      .send({ query: '{ health }' });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({ health: 'ok' });
  });

  it('allows the configured origin', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Origin', 'http://localhost:5173')
      .send({ query: '{ health }' });

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });

  it('does not allow an unconfigured origin', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Origin', 'http://evil.example')
      .send({ query: '{ health }' });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
```

The third test is the one worth having. CORS configured as `*` passes the second
test just as happily, and a permissive default is easy to introduce by accident
while debugging.

It also dictates how `cors` is configured. Handed a bare string, `cors` echoes
that string on every response regardless of the request's `Origin`, so the third
test fails against a server that is in fact secure. Handed an array, it compares
the request against the list and omits the header entirely when there is no
match. Both are safe in a browser; only the second is observable from a test.

- [x] **Step 3: Run the test to verify it fails**

Run: `npm test -w @financy/backend`
Expected: FAIL — cannot resolve `../../src/app.js`.

- [x] **Step 4: Write the schema module**

`backend/src/schema.ts`:

```ts
export const typeDefs = /* GraphQL */ `
  type Query {
    health: String!
  }
`;

export const resolvers = {
  Query: {
    health: () => 'ok',
  },
};
```

- [x] **Step 5: Write the application factory**

`backend/src/app.ts`:

```ts
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './shared/env.js';
import { resolvers, typeDefs } from './schema.js';

export async function createApp(): Promise<{
  app: Express;
  apollo: ApolloServer;
}> {
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();

  const app = express();

  app.use(
    '/graphql',
    cors({ origin: [env.CORS_ORIGIN], credentials: true }),
    express.json(),
    expressMiddleware(apollo),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return { app, apollo };
}
```

A factory rather than a module that starts listening on import: tests need the
app without a bound port, and two test files binding the same port fail in ways
that look like application bugs.

- [x] **Step 6: Write the entry point**

`backend/src/server.ts`:

```ts
import { createApp } from './app.js';
import { env } from './shared/env.js';

const { app } = await createApp();

app.listen(env.PORT, () => {
  console.log(`GraphQL ready at http://localhost:${env.PORT}/graphql`);
});
```

- [x] **Step 7: Run the tests to verify they pass**

Run: `npm test -w @financy/backend`
Expected: PASS — 3 tests in `health.test.ts`, plus the earlier suites.

- [x] **Step 8: Verify the server actually runs**

Run: `npm run dev:backend`
Expected: `GraphQL ready at http://localhost:4000/graphql`.

Then, in another terminal:

```bash
curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ health }"}'
```

Expected: `{"data":{"health":"ok"}}`. Stop the server.

- [x] **Step 9: Commit**

```bash
git add backend
git commit -m "feat(backend): serve GraphQL over Express with restricted CORS

CORS is pinned to CORS_ORIGIN rather than '*', and a test asserts an
unlisted origin gets no allow header — a permissive default passes
every other test and is easy to leave behind after debugging."
```

---

### Task 4: Frontend bootstrap

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/test/setup.ts`
- Test: `frontend/src/App.test.tsx`
- Delete: `frontend/.gitkeep`

**Interfaces:**
- Consumes: nothing.
- Produces: `App` — the root React component — from `src/App.tsx`.

- [x] **Step 1: Create the frontend package**

`frontend/package.json`:

```json
{
  "name": "@financy/frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Install:

```bash
npm install -w @financy/frontend react react-dom
npm install -w @financy/frontend -D typescript vite @vitejs/plugin-react \
  vitest jsdom @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event @types/react @types/react-dom
```

- [x] **Step 2: Configure TypeScript**

`frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "paths": { "@/*": ["./src/*"] },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

No `baseUrl`. TypeScript 6 raises `TS5101` on it — it is deprecated and removed
in 7 — and `paths` has resolved relative to the tsconfig's own directory since
TypeScript 5, so it was doing nothing here anyway.

- [x] **Step 3: Configure Vite and Vitest**

`frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    env: {
      VITE_BACKEND_URL: 'http://localhost:4000/graphql',
    },
  },
});
```

The `env` block mirrors the backend's, for the same reason. Task 5 adds
`src/lib/env.ts`, which parses `import.meta.env` at module load; Vite fills that
from `frontend/.env`, which is gitignored. Without this the suite passes on
the machine that wrote `.env` and fails on every fresh clone.

`defineConfig` comes from `vitest/config`, not `vite` — the one exported by
`vite` does not type the `test` key. `import.meta.dirname` rather than
`__dirname`, which Vite 8's native config loader warns about and will stop
supporting.

`frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [x] **Step 4: Write the failing test**

`frontend/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the application name', () => {
  render(<App />);
  expect(screen.getByText('Financy')).toBeInTheDocument();
});
```

- [x] **Step 5: Run the test to verify it fails**

Run: `npm test -w @financy/frontend`
Expected: FAIL — cannot resolve `./App`.

- [x] **Step 6: Implement the shell**

`frontend/src/App.tsx`:

```tsx
export function App() {
  return <h1>Financy</h1>;
}
```

`frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`frontend/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Financy</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`lang="pt-BR"` is not decoration: it tells screen readers which language to
pronounce, and the entire interface is Portuguese.

- [x] **Step 7: Run the test to verify it passes**

Run: `npm test -w @financy/frontend`
Expected: PASS.

- [x] **Step 8: Commit**

```bash
rm frontend/.gitkeep
git add frontend
git commit -m "feat(frontend): bootstrap Vite, React and the test harness"
```

---

### Task 5: Frontend environment and GraphQL client

**Files:**
- Create: `frontend/src/lib/env.ts`
- Create: `frontend/src/lib/graphql-client.ts`
- Create: `frontend/.env.example`
- Create: `frontend/.env`
- Create: `frontend/src/vite-env.d.ts`
- Test: `frontend/src/lib/env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseEnv(raw: Record<string, unknown>): AppEnv` and `env: AppEnv` from `src/lib/env.ts`, where `AppEnv` is `{ VITE_BACKEND_URL: string }`. `graphqlClient: GraphQLClient` and `setAuthToken(token: string | null): void` from `src/lib/graphql-client.ts`.

- [x] **Step 1: Install the client dependencies**

```bash
npm install -w @financy/frontend graphql graphql-request zod \
  @tanstack/react-query
```

- [x] **Step 2: Write the failing test**

`frontend/src/lib/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('parses a valid environment', () => {
    expect(parseEnv({ VITE_BACKEND_URL: 'http://localhost:4000/graphql' }))
      .toEqual({ VITE_BACKEND_URL: 'http://localhost:4000/graphql' });
  });

  it('throws when the backend URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/VITE_BACKEND_URL/);
  });

  it('throws when the backend URL is not a URL', () => {
    expect(() => parseEnv({ VITE_BACKEND_URL: 'localhost' })).toThrow(
      /VITE_BACKEND_URL/,
    );
  });
});
```

Without the third case, a typo in `.env` produces requests to a relative path
that fail with a 404 from the dev server — an error that points nowhere near the
actual mistake.

- [x] **Step 3: Run the test to verify it fails**

Run: `npm test -w @financy/frontend`
Expected: FAIL — cannot resolve `./env`.

- [x] **Step 4: Implement the environment module**

`frontend/src/lib/env.ts`:

```ts
import { z } from 'zod';

const envSchema = z.object({
  VITE_BACKEND_URL: z.url('VITE_BACKEND_URL must be a valid URL'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

export const env = parseEnv(import.meta.env);
```

zod 4 replaced the v3 `z.string({ required_error }).url()` form. `required_error`
is not an error under v4 — it is silently ignored, so a message written that way
never reaches the user. `z.url()` is the v4 spelling.

`frontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [x] **Step 5: Implement the GraphQL client**

`frontend/src/lib/graphql-client.ts`:

```ts
import { GraphQLClient } from 'graphql-request';
import { env } from './env';

export const graphqlClient = new GraphQLClient(env.VITE_BACKEND_URL);

export function setAuthToken(token: string | null): void {
  if (token) {
    graphqlClient.setHeader('Authorization', `Bearer ${token}`);
  } else {
    graphqlClient.setHeader('Authorization', '');
  }
}
```

Slice 1 replaces the session handling around this module; the client itself does
not need to know about storage or routing.

- [x] **Step 6: Write the environment files**

`frontend/.env.example` and `frontend/.env`, both:

```
VITE_BACKEND_URL=http://localhost:4000/graphql
```

Everything in a `VITE_`-prefixed variable is compiled into the bundle and is
public. No secret ever belongs in this file.

- [x] **Step 7: Run the tests to verify they pass**

Run: `npm test -w @financy/frontend`
Expected: PASS — 3 env tests plus the App test.

- [x] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat(frontend): validate environment and add the GraphQL client

A missing or malformed backend URL now fails at startup with a named
variable, instead of surfacing as 404s from the dev server."
```

---

### Task 6: Tailwind theme and category tokens

**Files:**
- Create: `frontend/src/index.css`
- Create: `frontend/src/lib/category-tokens.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/vite.config.ts`
- Test: `frontend/src/lib/category-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: from `src/lib/category-tokens.ts` — `CATEGORY_COLORS: Record<CategoryColor, { bg: string; text: string; icon: string }>`, `CATEGORY_ICONS: Record<CategoryIcon, LucideIcon>`, `CATEGORY_COLOR_VALUES: CategoryColor[]`, `CATEGORY_ICON_VALUES: CategoryIcon[]`. Types `CategoryColor` and `CategoryIcon` are string unions matching the backend enums.

- [x] **Step 1: Install Tailwind, fonts and icons**

```bash
npm install -w @financy/frontend tailwindcss @tailwindcss/vite \
  lucide-react @fontsource/inter
```

- [x] **Step 2: Register the Tailwind plugin**

In `frontend/vite.config.ts`, add the import and the plugin:

```ts
import tailwindcss from '@tailwindcss/vite';
```

and change the plugins array to:

```ts
  plugins: [react(), tailwindcss()],
```

- [x] **Step 3: Define the theme**

`frontend/src/index.css` — every value read from `frontend.md` section 3:

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;

  --color-brand-dark: #124b2b;
  --color-brand-base: #1f6f43;

  --color-gray-800: #111827;
  --color-gray-700: #374151;
  --color-gray-600: #4b5563;
  --color-gray-500: #6b7280;
  --color-gray-400: #9ca3af;
  --color-gray-300: #d1d5db;
  --color-gray-200: #e5e7eb;
  --color-gray-100: #f8f9fa;

  --color-danger: #ef4444;
  --color-success: #19ad70;

  --color-blue-dark: #1d4ed8;
  --color-blue-base: #2563eb;
  --color-blue-light: #dbeafe;

  --color-purple-dark: #7e22ce;
  --color-purple-base: #9333ea;
  --color-purple-light: #f3e8ff;

  --color-pink-dark: #be185d;
  --color-pink-base: #db2777;
  --color-pink-light: #fce7f3;

  --color-red-dark: #b91c1c;
  --color-red-base: #dc2626;
  --color-red-light: #fee2e2;

  --color-orange-dark: #c2410c;
  --color-orange-base: #ea580c;
  --color-orange-light: #ffedd5;

  --color-yellow-dark: #a16207;
  --color-yellow-base: #ca8a04;
  --color-yellow-light: #f7f3ca;

  --color-green-dark: #15803d;
  --color-green-base: #16a34a;
  --color-green-light: #e0fae9;
}

body {
  @apply bg-gray-100 font-sans text-gray-800 antialiased;
}
```

In `frontend/src/main.tsx`, add these imports above the others:

```tsx
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';
```

- [x] **Step 4: Write the failing test**

`frontend/src/lib/category-tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_VALUES,
  CATEGORY_ICONS,
  CATEGORY_ICON_VALUES,
} from './category-tokens';

describe('category tokens', () => {
  it('offers the seven colors from the design', () => {
    expect(CATEGORY_COLOR_VALUES).toEqual([
      'GREEN',
      'BLUE',
      'PURPLE',
      'PINK',
      'RED',
      'ORANGE',
      'YELLOW',
    ]);
  });

  it('offers the sixteen icons from the design', () => {
    expect(CATEGORY_ICON_VALUES).toHaveLength(16);
  });

  it('maps every color to a background, text and icon class', () => {
    for (const color of CATEGORY_COLOR_VALUES) {
      const classes = CATEGORY_COLORS[color];
      expect(classes.bg).toBeTruthy();
      expect(classes.text).toBeTruthy();
      expect(classes.icon).toBeTruthy();
    }
  });

  it('maps every icon token to a component', () => {
    for (const icon of CATEGORY_ICON_VALUES) {
      expect(CATEGORY_ICONS[icon]).toBeTypeOf('object');
    }
  });
});
```

These tests exist to catch a token added to one map and forgotten in the other,
which renders as a blank square rather than as an error.

- [x] **Step 5: Run the test to verify it fails**

Run: `npm test -w @financy/frontend`
Expected: FAIL — cannot resolve `./category-tokens`.

- [x] **Step 6: Implement the token maps**

`frontend/src/lib/category-tokens.ts`:

```ts
import {
  BookOpen,
  Bike,
  Briefcase,
  Bus,
  CreditCard,
  Gift,
  HandCoins,
  HeartPulse,
  House,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Store,
  Ticket,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type CategoryColor =
  | 'GREEN'
  | 'BLUE'
  | 'PURPLE'
  | 'PINK'
  | 'RED'
  | 'ORANGE'
  | 'YELLOW';

export type CategoryIcon =
  | 'BRIEFCASE'
  | 'BUS'
  | 'HEART_PULSE'
  | 'PIGGY_BANK'
  | 'SHOPPING_CART'
  | 'TICKET'
  | 'GIFT'
  | 'UTENSILS'
  | 'BIKE'
  | 'HOME'
  | 'HAND_COINS'
  | 'BOOK_OPEN'
  | 'STORE'
  | 'WALLET'
  | 'CREDIT_CARD'
  | 'RECEIPT';

/** Tag background and text, plus the icon color for a category badge. */
export const CATEGORY_COLORS: Record<
  CategoryColor,
  { bg: string; text: string; icon: string }
> = {
  GREEN: { bg: 'bg-green-light', text: 'text-green-dark', icon: 'text-green-base' },
  BLUE: { bg: 'bg-blue-light', text: 'text-blue-dark', icon: 'text-blue-base' },
  PURPLE: { bg: 'bg-purple-light', text: 'text-purple-dark', icon: 'text-purple-base' },
  PINK: { bg: 'bg-pink-light', text: 'text-pink-dark', icon: 'text-pink-base' },
  RED: { bg: 'bg-red-light', text: 'text-red-dark', icon: 'text-red-base' },
  ORANGE: { bg: 'bg-orange-light', text: 'text-orange-dark', icon: 'text-orange-base' },
  YELLOW: { bg: 'bg-yellow-light', text: 'text-yellow-dark', icon: 'text-yellow-base' },
};

export const CATEGORY_ICONS: Record<CategoryIcon, LucideIcon> = {
  BRIEFCASE: Briefcase,
  BUS: Bus,
  HEART_PULSE: HeartPulse,
  PIGGY_BANK: PiggyBank,
  SHOPPING_CART: ShoppingCart,
  TICKET: Ticket,
  GIFT: Gift,
  UTENSILS: Utensils,
  BIKE: Bike,
  HOME: House,
  HAND_COINS: HandCoins,
  BOOK_OPEN: BookOpen,
  STORE: Store,
  WALLET: Wallet,
  CREDIT_CARD: CreditCard,
  RECEIPT: Receipt,
};

export const CATEGORY_COLOR_VALUES = Object.keys(
  CATEGORY_COLORS,
) as CategoryColor[];

export const CATEGORY_ICON_VALUES = Object.keys(
  CATEGORY_ICONS,
) as CategoryIcon[];
```

Class names are written out in full rather than built by interpolation.
Tailwind scans source text for complete class names, so a template literal like
`` `bg-${color}-light` `` produces nothing at all in the compiled CSS.

- [x] **Step 7: Run the tests to verify they pass**

Run: `npm test -w @financy/frontend`
Expected: PASS — 4 token tests.

All sixteen names, plus the fifteen used by the primitives in tasks 7 to 11,
were confirmed to exist as exports of the installed `lucide-react`. That the
names resolve is not the same as their being the icons the design shows, which
is what step 8 is for.

- [x] **Step 8: Hand off the icon names for verification**

The sixteen icon tokens were read from a screenshot of the category dialog, and
the agent executing this plan has no Figma access. Record the sixteen
token-to-Lucide-name pairs in the slice's handoff checklist for the repository
owner to confirm against the Figma Style Guide. Any correction applies to both
`CATEGORY_ICONS` and `backend.md`'s `CategoryIcon` enum, which must stay
identical.

- [x] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add the design theme and category tokens

Class names are spelled out rather than interpolated: Tailwind scans
for whole class names, so a computed one compiles to nothing."
```

---

### Task 7: Form primitives

**Files:**
- Create: `frontend/src/lib/cn.ts`
- Create: `frontend/src/components/ui/Input.tsx`
- Create: `frontend/src/components/ui/PasswordInput.tsx`
- Create: `frontend/src/components/ui/Select.tsx`
- Test: `frontend/src/components/ui/Input.test.tsx`
- Test: `frontend/src/components/ui/PasswordInput.test.tsx`
- Test: `frontend/src/components/ui/Select.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `cn(...inputs: ClassValue[]): string` from `src/lib/cn.ts`. `Input`, `PasswordInput` and `Select` from `src/components/ui/`. All three forward refs and accept `label: string`, `helperText?: string`, `error?: string`, `icon?: LucideIcon`, plus the native element props. `Select` additionally takes `options: { value: string; label: string }[]` and `placeholder?: string`.

- [x] **Step 1: Install the class helpers**

```bash
npm install -w @financy/frontend clsx tailwind-merge
```

- [x] **Step 2: Write the class helper**

`frontend/src/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [x] **Step 3: Write the failing Input test**

`frontend/src/components/ui/Input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mail } from 'lucide-react';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the field', async () => {
    render(<Input label="E-mail" />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com');
    expect(screen.getByLabelText('E-mail')).toHaveValue('a@b.com');
  });

  it('renders helper text when there is no error', () => {
    render(<Input label="Senha" helperText="Mínimo 8 caracteres" />);
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('replaces helper text with the error message', () => {
    render(
      <Input label="Senha" helperText="Mínimo 8 caracteres" error="Muito curta" />,
    );
    expect(screen.getByText('Muito curta')).toBeInTheDocument();
    expect(screen.queryByText('Mínimo 8 caracteres')).not.toBeInTheDocument();
  });

  it('marks the field invalid and points to the message for assistive tech', () => {
    render(<Input label="Senha" error="Muito curta" />);
    const field = screen.getByLabelText('Senha');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Muito curta');
  });

  it('can be disabled', () => {
    render(<Input label="E-mail" disabled />);
    expect(screen.getByLabelText('E-mail')).toBeDisabled();
  });

  it('renders a leading icon without exposing it to screen readers', () => {
    const { container } = render(<Input label="E-mail" icon={Mail} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
```

The accessibility assertions are not ceremony. An error that is only red text
beside a field does not exist for someone using a screen reader.

- [x] **Step 4: Run the test to verify it fails**

Run: `npm test -w @financy/frontend -- Input`
Expected: FAIL — cannot resolve `./Input`.

- [x] **Step 5: Implement Input**

`frontend/src/components/ui/Input.tsx`:

```tsx
import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  icon?: LucideIcon;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, icon: Icon, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const description = error ?? helperText;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          'text-sm font-medium',
          error ? 'text-danger' : 'text-gray-700',
        )}
      >
        {label}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2',
              error ? 'text-danger' : 'text-gray-400',
            )}
          />
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            'w-full rounded-lg border bg-white py-2.5 text-sm text-gray-800',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-brand-base/30',
            'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400',
            Icon ? 'pl-9 pr-3' : 'px-3',
            error
              ? 'border-danger focus:border-danger'
              : 'border-gray-300 focus:border-brand-base',
            className,
          )}
          {...props}
        />
      </div>

      {description && (
        <p
          id={descriptionId}
          className={cn('text-xs', error ? 'text-danger' : 'text-gray-500')}
        >
          {description}
        </p>
      )}
    </div>
  );
});
```

- [x] **Step 6: Run the Input test to verify it passes**

Run: `npm test -w @financy/frontend -- Input`
Expected: PASS — 6 tests.

- [x] **Step 7: Write the failing PasswordInput test**

`frontend/src/components/ui/PasswordInput.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('hides the value by default', () => {
    render(<PasswordInput label="Senha" />);
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });

  it('reveals and hides the value when the toggle is used', async () => {
    render(<PasswordInput label="Senha" />);

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });
});
```

- [x] **Step 8: Implement PasswordInput**

`frontend/src/components/ui/PasswordInput.tsx`:

```tsx
import { forwardRef, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input, type InputProps } from './Input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'icon'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    const ToggleIcon = visible ? EyeOff : Eye;

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          icon={Lock}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
        >
          <ToggleIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  },
);
```

- [x] **Step 9: Write the failing Select test**

`frontend/src/components/ui/Select.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const options = [
  { value: 'INCOME', label: 'Entrada' },
  { value: 'EXPENSE', label: 'Saída' },
];

describe('Select', () => {
  it('associates the label with the control', () => {
    render(<Select label="Tipo" options={options} />);
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
  });

  it('renders every option', () => {
    render(<Select label="Tipo" options={options} />);
    expect(screen.getByRole('option', { name: 'Entrada' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Saída' })).toBeInTheDocument();
  });

  it('renders a placeholder as a disabled first option', () => {
    render(<Select label="Tipo" options={options} placeholder="Selecione" />);
    expect(screen.getByRole('option', { name: 'Selecione' })).toBeDisabled();
  });

  it('reports the chosen value', async () => {
    render(<Select label="Tipo" options={options} defaultValue="INCOME" />);
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'EXPENSE');
    expect(screen.getByLabelText('Tipo')).toHaveValue('EXPENSE');
  });

  it('shows the error message', () => {
    render(<Select label="Tipo" options={options} error="Obrigatório" />);
    expect(screen.getByLabelText('Tipo')).toHaveAccessibleDescription(
      'Obrigatório',
    );
  });
});
```

- [x] **Step 10: Implement Select**

`frontend/src/components/ui/Select.tsx`:

```tsx
import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  helperText?: string;
  error?: string;
  icon?: LucideIcon;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, helperText, error, icon: Icon, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = `${selectId}-description`;
  const description = error ?? helperText;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className={cn(
          'text-sm font-medium',
          error ? 'text-danger' : 'text-gray-700',
        )}
      >
        {label}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
          />
        )}
        <select
          id={selectId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            'w-full appearance-none rounded-lg border bg-white py-2.5 text-sm text-gray-800',
            'focus:outline-none focus:ring-2 focus:ring-brand-base/30',
            'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400',
            Icon ? 'pl-9 pr-9' : 'pl-3 pr-9',
            error
              ? 'border-danger focus:border-danger'
              : 'border-gray-300 focus:border-brand-base',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"
        />
      </div>

      {description && (
        <p
          id={descriptionId}
          className={cn('text-xs', error ? 'text-danger' : 'text-gray-500')}
        >
          {description}
        </p>
      )}
    </div>
  );
});
```

A native `<select>`, not a custom listbox. It is keyboard accessible, screen
reader accessible and mobile friendly at no cost, and the design's select is a
styled native control rather than a searchable combobox.

- [x] **Step 11: Run the tests to verify they pass**

Run: `npm test -w @financy/frontend`
Expected: PASS — 6 Input, 2 PasswordInput and 5 Select tests.

- [x] **Step 12: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add form primitives

Errors are wired through aria-invalid and aria-describedby, not only
color: red text beside a field does not exist for a screen reader."
```

---

### Task 8: Action primitives

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/IconButton.tsx`
- Create: `frontend/src/components/ui/TextLink.tsx`
- Create: `frontend/src/components/ui/Pagination.tsx`
- Test: `frontend/src/components/ui/Button.test.tsx`
- Test: `frontend/src/components/ui/IconButton.test.tsx`
- Test: `frontend/src/components/ui/Pagination.test.tsx`

**Interfaces:**
- Consumes: `cn` from `src/lib/cn.ts`.
- Produces: `Button` with `variant?: 'primary' | 'secondary'`, `size?: 'md' | 'sm'`, `icon?: LucideIcon`, `loading?: boolean`. `IconButton` with `icon: LucideIcon`, `label: string`, `variant?: 'neutral' | 'danger'`. `TextLink`, wrapping React Router's `Link`. `Pagination` with `page: number`, `pageCount: number`, `onPageChange: (page: number) => void`.

- [x] **Step 1: Install React Router**

```bash
npm install -w @financy/frontend react-router-dom
```

- [x] **Step 2: Write the failing Button test**

`frontend/src/components/ui/Button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { Button } from './Button';

describe('Button', () => {
  it('calls the handler when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call the handler when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disables itself while loading', () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('renders a leading icon hidden from screen readers', () => {
    const { container } = render(<Button icon={Plus}>Nova transação</Button>);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('defaults to type button', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute(
      'type',
      'button',
    );
  });
});
```

The last test prevents a real bug: a `<button>` inside a form defaults to
`type="submit"`, so a cancel button silently submits the form.

The loading test matters for a different reason — it is what stops a double
click from creating two transactions.

- [x] **Step 3: Run the test to verify it fails**

Run: `npm test -w @financy/frontend -- Button`
Expected: FAIL — cannot resolve `./Button`.

- [x] **Step 4: Implement Button**

`frontend/src/components/ui/Button.tsx`:

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  loading?: boolean;
}

const VARIANTS = {
  primary: cn(
    'bg-brand-base text-white',
    'hover:bg-brand-dark',
    'disabled:bg-brand-base/50',
  ),
  secondary: cn(
    'border border-gray-300 bg-white text-gray-700',
    'hover:bg-gray-200',
    'disabled:border-gray-200 disabled:text-gray-400 disabled:bg-white',
  ),
} as const;

const SIZES = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled ?? loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-base/30',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        Icon && <Icon aria-hidden="true" className="size-4" />
      )}
      {children}
    </button>
  );
});
```

- [x] **Step 5: Write the failing IconButton test**

`frontend/src/components/ui/IconButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Trash2 } from 'lucide-react';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('is findable by its accessible name', () => {
    render(<IconButton icon={Trash2} label="Excluir transação" />);
    expect(
      screen.getByRole('button', { name: 'Excluir transação' }),
    ).toBeInTheDocument();
  });

  it('calls the handler when clicked', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Trash2} label="Excluir" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call the handler when disabled', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Trash2} label="Excluir" onClick={onClick} disabled />);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

`label` is required rather than optional. A button whose only content is an icon
is an unlabelled button, and every row of both tables is full of them.

- [x] **Step 6: Implement IconButton**

`frontend/src/components/ui/IconButton.tsx`:

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  variant?: 'neutral' | 'danger';
}

const VARIANTS = {
  neutral: 'border-gray-300 text-gray-600 hover:bg-gray-200',
  danger: 'border-danger/30 text-danger hover:bg-red-light',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { icon: Icon, label, variant = 'neutral', className, type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg border bg-white',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-base/30',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white',
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    );
  },
);
```

- [x] **Step 7: Implement TextLink**

`frontend/src/components/ui/TextLink.tsx`:

```tsx
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function TextLink({ className, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        'text-sm font-medium text-brand-base hover:underline',
        'focus:outline-none focus:ring-2 focus:ring-brand-base/30 rounded',
        className,
      )}
      {...props}
    />
  );
}
```

- [x] **Step 8: Write the failing Pagination test**

`frontend/src/components/ui/Pagination.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('marks the current page', () => {
    render(<Pagination page={2} pageCount={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('reports the page that was chosen', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous on the first page', () => {
    render(<Pagination page={1} pageCount={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
  });

  it('disables next on the last page', () => {
    render(<Pagination page={3} pageCount={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
  });

  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [x] **Step 9: Implement Pagination**

`frontend/src/components/ui/Pagination.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav aria-label="Paginação" className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg border border-gray-300 bg-white',
          'text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white',
        )}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>

      {pages.map((value) => (
        <button
          key={value}
          type="button"
          aria-current={value === page ? 'page' : undefined}
          onClick={() => onPageChange(value)}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-lg border text-sm font-medium',
            value === page
              ? 'border-brand-base bg-brand-base text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-200',
          )}
        >
          {value}
        </button>
      ))}

      <button
        type="button"
        aria-label="Próxima página"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg border border-gray-300 bg-white',
          'text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white',
        )}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}
```

Every page number is rendered. Slice 4 revisits this if a user's history grows
past a page count that fits on the line; building ellipsis logic now would be
solving a problem no one has.

- [x] **Step 10: Run the tests to verify they pass**

Run: `npm test -w @financy/frontend`
Expected: PASS — 5 Button, 3 IconButton and 5 Pagination tests.

- [x] **Step 11: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add action primitives

Button defaults to type=button so a cancel inside a form does not
submit it, and disables itself while loading so a double click cannot
fire a mutation twice."
```

---

### Task 9: Display primitives

**Files:**
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/StatCard.tsx`
- Create: `frontend/src/components/ui/Tag.tsx`
- Create: `frontend/src/components/ui/TypeIndicator.tsx`
- Create: `frontend/src/components/ui/CategoryBadge.tsx`
- Create: `frontend/src/components/ui/Avatar.tsx`
- Create: `frontend/src/components/ui/Dialog.tsx`
- Test: `frontend/src/components/ui/Tag.test.tsx`
- Test: `frontend/src/components/ui/TypeIndicator.test.tsx`
- Test: `frontend/src/components/ui/Avatar.test.tsx`
- Test: `frontend/src/components/ui/Dialog.test.tsx`

**Interfaces:**
- Consumes: `cn`, `CATEGORY_COLORS`, `CATEGORY_ICONS`, `CategoryColor`, `CategoryIcon`.
- Produces: `Card`, `StatCard` (`icon`, `label`, `value`), `Tag` (`color?: CategoryColor | 'NEUTRAL'`), `TypeIndicator` (`type: 'INCOME' | 'EXPENSE'`), `CategoryBadge` (`icon?`, `color?`), `Avatar` (`name: string`, `size?: 'sm' | 'lg'`), `Dialog` (`open`, `onClose`, `title`, `subtitle?`, `children`). Also `initialsFromName(name: string): string` from `src/lib/initials.ts`.

`initialsFromName` lives in `src/lib/initials.ts` rather than beside `Avatar`.
A component file that also exports a plain function breaks React Fast Refresh,
which `eslint-plugin-react-refresh` flags — and a pure string function belongs
in `lib/` regardless of who happens to call it. Its four tests move with it to
`src/lib/initials.test.ts`.

- [x] **Step 1: Install the dialog primitive**

```bash
npm install -w @financy/frontend @radix-ui/react-dialog
```

Radix handles focus trapping, restoring focus on close, `Escape`, scroll locking
and the ARIA wiring. Hand-rolling those is how a dialog ends up unusable by
keyboard.

- [x] **Step 2: Implement Card and StatCard**

`frontend/src/components/ui/Card.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-gray-200 bg-white', className)}
      {...props}
    />
  );
}
```

`frontend/src/components/ui/StatCard.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from './Card';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  iconClassName?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  iconClassName,
}: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className={cn('size-4 text-gray-500', iconClassName)} />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-800">{value}</p>
    </Card>
  );
}
```

- [x] **Step 3: Write the failing Tag test**

`frontend/src/components/ui/Tag.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Tag } from './Tag';

describe('Tag', () => {
  it('renders its label', () => {
    render(<Tag color="BLUE">Alimentação</Tag>);
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
  });

  it('applies the color family from the design', () => {
    render(<Tag color="BLUE">Alimentação</Tag>);
    const tag = screen.getByText('Alimentação');
    expect(tag).toHaveClass('bg-blue-light');
    expect(tag).toHaveClass('text-blue-dark');
  });

  it('falls back to neutral for an uncategorized transaction', () => {
    render(<Tag>Sem categoria</Tag>);
    const tag = screen.getByText('Sem categoria');
    expect(tag).toHaveClass('bg-gray-200');
    expect(tag).toHaveClass('text-gray-600');
  });
});
```

- [x] **Step 4: Implement Tag and CategoryBadge**

`frontend/src/components/ui/Tag.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CATEGORY_COLORS, type CategoryColor } from '@/lib/category-tokens';

export interface TagProps {
  color?: CategoryColor;
  children: ReactNode;
  className?: string;
}

const NEUTRAL = { bg: 'bg-gray-200', text: 'text-gray-600' };

export function Tag({ color, children, className }: TagProps) {
  const palette = color ? CATEGORY_COLORS[color] : NEUTRAL;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        palette.bg,
        palette.text,
        className,
      )}
    >
      {children}
    </span>
  );
}
```

`frontend/src/components/ui/CategoryBadge.tsx`:

```tsx
import { Tag as TagIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type CategoryColor,
  type CategoryIcon,
} from '@/lib/category-tokens';

export interface CategoryBadgeProps {
  icon?: CategoryIcon;
  color?: CategoryColor;
  className?: string;
}

export function CategoryBadge({ icon, color, className }: CategoryBadgeProps) {
  const palette = color
    ? CATEGORY_COLORS[color]
    : { bg: 'bg-gray-200', icon: 'text-gray-500' };
  const Icon = icon ? CATEGORY_ICONS[icon] : TagIcon;

  return (
    <span
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg',
        palette.bg,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('size-4', palette.icon)} />
    </span>
  );
}
```

Both fall back to neutral when the category is absent. A transaction can have no
category from the day it is created, and any category can be deleted out from
under one — the design has no state for that, so this is where it is handled.

- [x] **Step 5: Write the failing TypeIndicator test**

`frontend/src/components/ui/TypeIndicator.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { TypeIndicator } from './TypeIndicator';

describe('TypeIndicator', () => {
  it('labels income as Entrada', () => {
    render(<TypeIndicator type="INCOME" />);
    expect(screen.getByText('Entrada')).toHaveClass('text-success');
  });

  it('labels expense as Saída', () => {
    render(<TypeIndicator type="EXPENSE" />);
    expect(screen.getByText('Saída')).toHaveClass('text-danger');
  });
});
```

- [x] **Step 6: Implement TypeIndicator**

`frontend/src/components/ui/TypeIndicator.tsx`:

```tsx
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface TypeIndicatorProps {
  type: TransactionType;
  className?: string;
}

export function TypeIndicator({ type, className }: TypeIndicatorProps) {
  const isIncome = type === 'INCOME';
  const Icon = isIncome ? ArrowUpCircle : ArrowDownCircle;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        isIncome ? 'text-success' : 'text-danger',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {isIncome ? 'Entrada' : 'Saída'}
    </span>
  );
}
```

- [x] **Step 7: Write the failing Avatar test**

`frontend/src/components/ui/Avatar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Avatar, initialsFromName } from './Avatar';

describe('initialsFromName', () => {
  it('takes the first and last initials', () => {
    expect(initialsFromName('Conta teste')).toBe('CT');
  });

  it('uses one letter for a single name', () => {
    expect(initialsFromName('Otávio')).toBe('O');
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(initialsFromName('  Ana   Maria  Silva  ')).toBe('AS');
  });

  it('returns an empty string for an empty name', () => {
    expect(initialsFromName('   ')).toBe('');
  });
});

describe('Avatar', () => {
  it('shows the initials and keeps the full name available', () => {
    render(<Avatar name="Conta teste" />);
    expect(screen.getByText('CT')).toBeInTheDocument();
    expect(screen.getByTitle('Conta teste')).toBeInTheDocument();
  });
});
```

- [x] **Step 8: Implement Avatar**

`frontend/src/components/ui/Avatar.tsx`:

```tsx
import { cn } from '@/lib/cn';

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();

  const first = parts[0]!.charAt(0);
  const last = parts[parts.length - 1]!.charAt(0);
  return `${first}${last}`.toUpperCase();
}

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-9 text-xs',
  lg: 'size-20 text-2xl',
} as const;

export function Avatar({ name, size = 'sm', className }: AvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gray-300 font-medium text-gray-700',
        SIZES[size],
        className,
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}
```

- [x] **Step 9: Write the failing Dialog test**

`frontend/src/components/ui/Dialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={vi.fn()} title="Nova transação">
        <p>Conteúdo</p>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the title, subtitle and content when open', () => {
    render(
      <Dialog
        open
        onClose={vi.fn()}
        title="Nova transação"
        subtitle="Registre sua despesa ou receita"
      >
        <p>Conteúdo</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Nova transação');
    expect(screen.getByText('Registre sua despesa ou receita')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('closes on the close button', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Nova transação">
        <p>Conteúdo</p>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Nova transação">
        <p>Conteúdo</p>
      </Dialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [x] **Step 10: Implement Dialog**

`frontend/src/components/ui/Dialog.tsx`:

```tsx
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-gray-800/40" />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2
            -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg focus:outline-none"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-base font-bold text-gray-800">
                {title}
              </RadixDialog.Title>
              {subtitle && (
                <RadixDialog.Description className="mt-0.5 text-sm text-gray-500">
                  {subtitle}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-gray-500 hover:bg-gray-200
                focus:outline-none focus:ring-2 focus:ring-brand-base/30"
            >
              <X aria-hidden="true" className="size-4" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
```

- [x] **Step 11: Run the tests to verify they pass**

Run: `npm test -w @financy/frontend`
Expected: PASS — 3 Tag, 2 TypeIndicator, 5 Avatar and 4 Dialog tests.

- [x] **Step 12: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add display primitives

Tag and CategoryBadge both fall back to neutral without a category.
A transaction can be created without one and can lose one when its
category is deleted; the design has no state for that."
```

---

### Task 10: Application shell and routing

**Files:**
- Create: `frontend/src/components/layout/TopBar.tsx`
- Create: `frontend/src/components/layout/PageShell.tsx`
- Create: `frontend/src/routes.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Test: `frontend/src/components/layout/TopBar.test.tsx`

**Interfaces:**
- Consumes: `Avatar`, `cn`.
- Produces: `TopBar` (`userName: string`), `PageShell` (`title`, `subtitle?`, `action?`, `children`), `AppRoutes` from `src/routes.tsx`.

- [x] **Step 1: Write the failing TopBar test**

`frontend/src/components/layout/TopBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TopBar } from './TopBar';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar userName="Conta teste" />
    </MemoryRouter>,
  );
}

describe('TopBar', () => {
  it('links to every section', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Transações' })).toHaveAttribute(
      'href',
      '/transactions',
    );
    expect(screen.getByRole('link', { name: 'Categorias' })).toHaveAttribute(
      'href',
      '/categories',
    );
  });

  it('marks the active section for assistive tech', () => {
    renderAt('/transactions');
    expect(screen.getByRole('link', { name: 'Transações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('links the avatar to the profile', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /perfil/i })).toHaveAttribute(
      'href',
      '/profile',
    );
  });
});
```

The active item is marked with `aria-current`, not only with green text. Color
alone conveys nothing to a screen reader and nothing to someone who cannot
distinguish it.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -w @financy/frontend -- TopBar`
Expected: FAIL — cannot resolve `./TopBar`.

- [x] **Step 3: Implement TopBar**

`frontend/src/components/layout/TopBar.tsx`:

```tsx
import { NavLink, Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';

const SECTIONS = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transações' },
  { to: '/categories', label: 'Categorias' },
] as const;

export interface TopBarProps {
  userName: string;
}

export function TopBar({ userName }: TopBarProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="text-lg font-bold text-brand-base">
          Financy
        </Link>

        <nav aria-label="Principal" className="flex items-center gap-6">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.to === '/'}
              className={({ isActive }) =>
                cn(
                  'text-sm hover:text-brand-base',
                  isActive ? 'font-semibold text-brand-base' : 'text-gray-600',
                )
              }
            >
              {section.label}
            </NavLink>
          ))}
        </nav>

        <Link to="/profile" aria-label={`Perfil de ${userName}`}>
          <Avatar name={userName} />
        </Link>
      </div>
    </header>
  );
}
```

`NavLink` sets `aria-current="page"` on the active route by itself.

- [x] **Step 4: Implement PageShell**

`frontend/src/components/layout/PageShell.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface PageShellProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  title,
  subtitle,
  action,
  children,
}: PageShellProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </main>
  );
}
```

- [x] **Step 5: Implement the routes**

`frontend/src/routes.tsx` — placeholders that slices 1 through 5 replace,
each named for the page it will become:

```tsx
import { Route, Routes } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { PageShell } from '@/components/layout/PageShell';

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <TopBar userName="Conta teste" />
      <PageShell title={title} subtitle="Em construção">
        <p className="text-sm text-gray-500">Esta página chega em uma fatia futura.</p>
      </PageShell>
    </>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="Dashboard" />} />
      <Route path="/transactions" element={<Placeholder title="Transações" />} />
      <Route path="/categories" element={<Placeholder title="Categorias" />} />
      <Route path="/profile" element={<Placeholder title="Perfil" />} />
      <Route path="*" element={<Placeholder title="Página não encontrada" />} />
    </Routes>
  );
}
```

- [x] **Step 6: Wire the router into App**

`frontend/src/App.tsx`:

```tsx
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

`refetchOnWindowFocus` is off: a background refetch every time the user alts back
to the browser is noise for data that only changes when they change it.

- [x] **Step 7: Update the App test**

Replace `frontend/src/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the dashboard route at the root path', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
});
```

- [x] **Step 8: Run the tests to verify they pass**

Run: `npm test -w @financy/frontend`
Expected: PASS — 3 TopBar tests plus the updated App test.

- [x] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat(frontend): add the app shell and routing skeleton

Active navigation is marked with aria-current, not only green text:
color alone conveys nothing to a screen reader."
```

---

### Task 11: Style guide route and slice verification

**Files:**
- Create: `frontend/src/pages/StyleGuide.tsx`
- Test: `frontend/src/pages/StyleGuide.test.tsx`
- Modify: `frontend/src/routes.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: every primitive from `src/components/ui/`.
- Produces: the `/style-guide` route.

- [x] **Step 1: Build the style guide page**

`frontend/src/pages/StyleGuide.tsx`:

```tsx
import { useState } from 'react';
import { Mail, Plus, Trash2, Pencil, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Select } from '@/components/ui/Select';
import { Tag } from '@/components/ui/Tag';
import { TypeIndicator } from '@/components/ui/TypeIndicator';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Dialog } from '@/components/ui/Dialog';
import { Pagination } from '@/components/ui/Pagination';
import { PageShell } from '@/components/layout/PageShell';
import {
  CATEGORY_COLOR_VALUES,
  CATEGORY_ICON_VALUES,
} from '@/lib/category-tokens';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-6 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="flex flex-wrap items-end gap-4">{children}</div>
    </Card>
  );
}

export function StyleGuide() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  return (
    <PageShell title="Style Guide" subtitle="Todos os primitivos, em todos os estados">
      <Section title="Button">
        <Button>Primário</Button>
        <Button icon={Plus}>Com ícone</Button>
        <Button disabled>Desabilitado</Button>
        <Button loading>Carregando</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="secondary" disabled>Secundário desabilitado</Button>
        <Button size="sm">Pequeno</Button>
        <Button size="sm" variant="secondary">Pequeno secundário</Button>
      </Section>

      <Section title="Icon Button">
        <IconButton icon={Pencil} label="Editar" />
        <IconButton icon={Trash2} label="Excluir" variant="danger" />
        <IconButton icon={Pencil} label="Editar desabilitado" disabled />
      </Section>

      <Section title="Input">
        <div className="w-64"><Input label="E-mail" placeholder="mail@exemplo.com" icon={Mail} helperText="Helper" /></div>
        <div className="w-64"><Input label="E-mail" defaultValue="preenchido@exemplo.com" icon={Mail} /></div>
        <div className="w-64"><Input label="E-mail" defaultValue="errado" icon={Mail} error="E-mail inválido" /></div>
        <div className="w-64"><Input label="E-mail" defaultValue="bloqueado" icon={Mail} disabled /></div>
        <div className="w-64"><PasswordInput label="Senha" helperText="Mínimo 8 caracteres" /></div>
        <div className="w-64">
          <Select
            label="Tipo"
            placeholder="Selecione"
            options={[
              { value: 'INCOME', label: 'Entrada' },
              { value: 'EXPENSE', label: 'Saída' },
            ]}
          />
        </div>
      </Section>

      <Section title="Tag">
        {CATEGORY_COLOR_VALUES.map((color) => (
          <Tag key={color} color={color}>{color}</Tag>
        ))}
        <Tag>Sem categoria</Tag>
      </Section>

      <Section title="Category Badge">
        {CATEGORY_ICON_VALUES.map((icon, index) => (
          <CategoryBadge
            key={icon}
            icon={icon}
            color={CATEGORY_COLOR_VALUES[index % CATEGORY_COLOR_VALUES.length]}
          />
        ))}
        <CategoryBadge />
      </Section>

      <Section title="Type Indicator">
        <TypeIndicator type="INCOME" />
        <TypeIndicator type="EXPENSE" />
      </Section>

      <Section title="Avatar">
        <Avatar name="Conta teste" />
        <Avatar name="Conta teste" size="lg" />
      </Section>

      <Section title="Stat Card">
        <div className="w-64">
          <StatCard icon={Wallet} label="Saldo total" value="R$ 12.847,32" />
        </div>
      </Section>

      <Section title="Pagination">
        <Pagination page={page} pageCount={3} onPageChange={setPage} />
      </Section>

      <Section title="Dialog">
        <Button onClick={() => setDialogOpen(true)}>Abrir diálogo</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Nova transação"
          subtitle="Registre sua despesa ou receita"
        >
          <div className="flex flex-col gap-4">
            <Input label="Descrição" placeholder="Ex. Almoço no restaurante" />
            <Button className="w-full">Salvar</Button>
          </div>
        </Dialog>
      </Section>
    </PageShell>
  );
}
```

- [x] **Step 1b: Cover the page with a render test**

`frontend/src/pages/StyleGuide.test.tsx` asserts that every section heading
is present, that all seven colors and sixteen icon badges render, and that the
dialog opens. It says nothing about appearance — that is what step 3 is for.
What it prevents is the page silently becoming a blank screen between the later
slices that depend on it, which a once-off manual look would not catch.

- [x] **Step 2: Register the route**

In `frontend/src/routes.tsx`, add the import:

```tsx
import { StyleGuide } from '@/pages/StyleGuide';
```

and add this route above the catch-all:

```tsx
      <Route path="/style-guide" element={<StyleGuide />} />
```

- [x] **Step 3: Hand off the Figma comparison**

Run: `npm run dev:frontend`, then open `http://localhost:5173/style-guide`.

The comparison itself is the repository owner's, since the agent has no Figma
access. Produce a checklist naming each group to check side by side with the
Figma Style Guide tab: button fills, borders and disabled opacity; input border,
radius and the error state coloring the label; tag padding and radius; the
pagination active state; the icon badge background. The owner reports the
differences, the agent corrects the components, and any deliberate difference is
recorded in `frontend.md`, section 12.

- [x] **Step 4: Verify both applications run together**

Terminal one: `npm run dev:backend` — expect `GraphQL ready at http://localhost:4000/graphql`.
Terminal two: `npm run dev:frontend` — expect Vite serving on 5173.

Open `http://localhost:5173/` and confirm the shell renders with navigation.
Then confirm the two are actually connected, in the browser console:

```js
await fetch('http://localhost:4000/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '{ health }' }),
}).then((r) => r.json());
```

Expected: `{data: {health: 'ok'}}`. A CORS failure here means `CORS_ORIGIN` does
not match the Vite origin — this is exactly the check that catches it before
slice 1 builds on top of it.

Note that this fails for a boring reason if port 5173 is already taken: Vite
falls back to 5174 without complaint, and 5174 is not what `CORS_ORIGIN` names.
Check what Vite actually printed before treating a rejection as a bug. The same
distinction can be drawn from the terminal, which does not care what port Vite
got:

```bash
curl -s -i -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5173' \
  -d '{"query":"{ health }"}' | grep -i access-control-allow-origin
```

The configured origin must come back with the header; any other origin must come
back without one.

- [x] **Step 5: Run the whole suite and the type checks**

```bash
npm test
npm run typecheck
```

Expected: all suites pass; no type errors in either workspace.

- [x] **Step 6: Update the README**

In `README.md`, replace the existing Status section with a Status section and a
new "Running locally" section, containing exactly this content:

- A heading `## Status`, then the line: "Slice 0 of 5 complete: both
  applications run, and the design system is built. See
  `docs/plans/roadmap.md` for the plan." — with `docs/plans/roadmap.md` as a
  markdown link.
- A task list, in this order, with the first three checked:
  `[x] Backend spec`, `[x] Frontend spec`, `[x] Slice 0 — Foundations`,
  `[ ] Slice 1 — Auth and profile`, `[ ] Slice 2 — Categories`,
  `[ ] Slice 3 — Transactions`, `[ ] Slice 4 — Search, filters, pagination`,
  `[ ] Slice 5 — Dashboard`.
- The existing line about password recovery being deferred to phase 2, kept as is.
- A heading `## Running locally`, the line "Requires Node 20 or newer.", and a
  `bash` code block containing these six lines:

      npm install
      cp backend/.env.example backend/.env   # then fill in JWT_SECRET
      cp frontend/.env.example frontend/.env

      npm run dev:backend    # http://localhost:4000/graphql
      npm run dev:frontend   # http://localhost:5173

- A closing line: "The design system is browsable at `/style-guide`."

- [x] **Step 7: Commit**

```bash
git add frontend README.md
git commit -m "feat(frontend): add a style guide route for the design system

Every primitive in every state on one page, so drift from the Figma
Style Guide is visible in one look rather than discovered screen by
screen later."
```

---

## Slice completion checklist

Before opening the pull request, confirm every line of the definition of done in
[`roadmap.md`](./roadmap.md), plus:

- [x] `npm test` passes in both workspaces.
- [x] `npm run typecheck` passes in both workspaces.
- [x] `npm run lint` and `npm run format:check` pass at the root.
- [x] `npm run dev:backend` and `npm run dev:frontend` both start.
- [ ] `/style-guide` renders every primitive and was compared against Figma.
      *(Renders — covered by `StyleGuide.test.tsx`. The Figma comparison is
      still open: the file URL is not recorded in `frontend.md` and the agent
      has no access. Carried into slice 1.)*
- [x] The browser can reach the API without a CORS error.
- [x] `backend/.env` and `frontend/.env` are untracked; both
      `.env.example` files are committed and list every variable in use.
- [ ] The sixteen Lucide icon names were confirmed against Figma by the
      repository owner, and `backend.md`'s `CategoryIcon` enum matches
      `category-tokens.ts` exactly.
      *(The enum and the token map do match — asserted by
      `category-tokens.test.ts`. The owner's confirmation against Figma is
      outstanding, and blocks slice 2, which is the first slice to render
      category icons.)*
- [ ] The `/style-guide` Figma comparison checklist was handed to the owner and
      the reported differences were corrected.
      *(Handed over; no differences reported back yet.)*

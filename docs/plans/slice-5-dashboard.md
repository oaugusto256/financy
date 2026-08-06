# Slice 5 — Dashboard — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `summary(month, year)` query and the dashboard screen it
feeds, so `/` stops being a placeholder and the two `['Summary']` invalidations
that have been dead since slice 3 start working.

**Architecture:** One new backend module (`modules/summary/`) resolving one root
field from two `groupBy` calls inside a single `prisma.$transaction`, with the
month window built in **UTC**. One new frontend feature directory
(`features/dashboard/`) whose three sections each own their query, their query
key and their four states, so a failure in one does not blank the others. The
seed is re-based from fixed 2026 dates to dates relative to the run, or the
dashboard reads zeros from September 2026 onward.

**Tech Stack:** Backend — TypeScript, Apollo Server 4, Prisma 6 (SQLite), zod 4,
vitest + supertest. Frontend — React 19, TanStack Query 5, graphql-codegen 7
(`typescript-operations` + `typescript-react-query`), Tailwind 4, vitest + MSW +
Testing Library.

**Source design:** [`slice-5-dashboard-design.md`](./slice-5-dashboard-design.md).
Every decision below traces to it; the four places this plan resolves something
the design left contradictory or factually wrong are marked
**[design correction]** and are collected in Task 10.

**Branch:** `feat/slice-5-dashboard`, from `main` at `af70069`.

## Global Constraints

Every task's requirements implicitly include this section.

- **TypeScript `strict: true` everywhere. No `any`** — lint rejects it outside
  `generated/`.
- **Interface language is Brazilian Portuguese. Code, comments, commit messages
  and PR descriptions are English.**
- **Conventional Commits, one commit per task.**
- **Colors come from the theme in `src/index.css`.** No color literal outside it.
- **Icons: `lucide-react` only.**
- **Tailwind never sees a class name built at runtime.** No template string, no
  `.replace()`, no interpolation — spell the class out and compose with `cn()`.
  A constructed class compiles to nothing and the element renders unstyled,
  which no test catches.
- **zod 4**: `z.email()` not `z.string().email()`; `required_error` is silently
  ignored — set every message positionally, through `.min`/`.max`, or as
  `{ error: '…' }`.
- **Pinned majors — do not let an install drift them.** `prisma` and
  `@prisma/client` `^6`; `@apollo/server` `^4`; `express` and `@types/express`
  `^4`. Check `git diff package.json apps/*/package.json` before every commit.
  No task in this slice installs anything.
- **Run anything you cite as evidence through `rtk proxy "<cmd>"`.** The RTK hook
  filters output and has reported a pass for a command that failed. A claim from
  a filtered run is not verified. Note `rtk proxy` chokes on unquoted `|` inside
  `find`; wrap the whole command in double quotes.
- **`codegen:check` diffs against the git *index*, not the working tree.** On any
  task that changes the SDL or a `.graphql` operation, `git add` **first**, then
  run `codegen:check`.
- **`format:check` is part of the gate**, alongside `test`, `typecheck`, `lint`
  and `codegen:check`. Two slice-2 tasks were sent back for skipping it.
- **`apps/backend/schema.graphql` is generated, committed, and in
  `.prettierignore`.** Never hand-edit it and never run Prettier on it.
- **No CI.** Nothing runs the checks on push. Every claim about a green suite
  comes from a local run.
- **Test credentials live in `tests/helpers/credentials.ts` (backend) and
  `src/test/credentials.ts` (frontend)** — `.gitguardian.yaml` exempts only
  those two files.
- **MSW is strict** (`onUnhandledRequest: 'error'`). A component that fires an
  unmocked request fails the test.
- **Frontend tests run under `TZ=America/Sao_Paulo`** (UTC-3), pinned both in
  the npm script and in `vite.config.ts`.
- Run the two suites **separately** (`npm test -w @financy/backend`, then
  `npm test -w @financy/frontend`). One combined run on a loaded machine fails
  frontend files on vitest worker-startup timeouts, which is contention, not a
  test failure (`slice-3-outcome.md`).

## File Structure

**Backend — created**

| File | Responsibility |
|---|---|
| `apps/backend/src/modules/summary/validation.ts` | `summaryArgsSchema` — `month` 1–12, `year` 1970–9999. |
| `apps/backend/src/modules/summary/service.ts` | `getSummary(userId, args)` — the UTC window and the two `groupBy` calls. |
| `apps/backend/src/modules/summary/schema.ts` | `summaryTypeDefs` — `type Summary` and `extend type Query`. |
| `apps/backend/src/modules/summary/resolvers.ts` | `summaryResolvers` — `requireUser` then the service. |
| `apps/backend/prisma/seed-dates.ts` | `monthsBack(monthsAgo, day, now?)` — the seed's relative-date arithmetic, extracted so it is testable. |
| `apps/backend/tests/unit/summary-validation.test.ts` | `summaryArgsSchema` in isolation. |
| `apps/backend/tests/unit/seed-dates.test.ts` | `monthsBack` rollover arithmetic. |
| `apps/backend/tests/integration/summary.test.ts` | `summary` through the real HTTP stack. |

**Backend — modified**

| File | Change |
|---|---|
| `apps/backend/src/schema.ts` | Register `summaryTypeDefs` and `summaryResolvers.Query`. |
| `apps/backend/schema.graphql` | Regenerated (never hand-edited). |
| `apps/backend/src/graphql/generated/resolvers.ts` | Regenerated. |
| `apps/backend/prisma/seed.ts` | Fixed 2026 dates → `monthsAgo`/`day` pairs across twelve months. |

**Frontend — created**

| File | Responsibility |
|---|---|
| `apps/frontend/src/graphql/operations/summary.graphql` | The `Summary` query document. |
| `apps/frontend/src/features/dashboard/DashboardPage.tsx` | The screen: three stat cards, the two-panel row, the create dialog. Owns the `Summary` query. |
| `apps/frontend/src/features/dashboard/RecentTransactionsPanel.tsx` | "Transações recentes". Owns its `Transactions` query and its own states. |
| `apps/frontend/src/features/dashboard/CategoriesPanel.tsx` | "Categorias". Owns its `Categories` query, the sort and the cap. |
| `apps/frontend/src/features/dashboard/DashboardPage.test.tsx` | Stat cards, composition, cross-section invalidation, navigation. |
| `apps/frontend/src/features/dashboard/RecentTransactionsPanel.test.tsx` | The recent panel's four states and its `limit: 5`. |
| `apps/frontend/src/features/dashboard/CategoriesPanel.test.tsx` | The categories panel's four states, its sort and its cap. |

**Frontend — modified**

| File | Change |
|---|---|
| `apps/frontend/src/lib/period.ts` | Add `currentPeriod(now?)`. |
| `apps/frontend/src/lib/period.test.ts` | Cover it. |
| `apps/frontend/src/graphql/operations/categories.graphql` | Add `totalAmount` to the `Categories` query — the panel renders it and nothing selects it today. |
| `apps/frontend/src/graphql/generated/graphql.ts` | Regenerated. |
| `apps/frontend/src/graphql/generated/query-keys.test.ts` | Assert the `Summary` key literal the two mutation dialogs invalidate by. |
| `apps/frontend/src/routes.tsx` | `<Placeholder title="Dashboard" />` → `<DashboardPage />`; delete `Placeholder`. |
| `apps/frontend/src/routes.test.tsx` | Its two dashboard tests must now mock three more queries — MSW is strict. |

**Docs — modified in Task 10**

`docs/plans/roadmap.md`, `docs/specs/backend.md`, `docs/specs/frontend.md`, plus
new `docs/plans/slice-5-figma-handoff.md` and `docs/plans/slice-5-outcome.md`.

## Task order and why

1–3 are the backend, innermost first (validation → service → wiring), because
the frontend's codegen reads `apps/backend/schema.graphql`, which does not carry
`summary` until Task 3 commits. 4 regenerates the frontend client and proves the
query key. 5–7 build the three sections in isolation. 8 composes them, mounts the
route, and runs the one test that has to be seen to fail first. 9 re-bases the
seed. 10 is the documentation the definition of done requires.

---

### Task 1: `summary` argument validation

**Files:**
- Create: `apps/backend/src/modules/summary/validation.ts`
- Test: `apps/backend/tests/unit/summary-validation.test.ts`

**Interfaces:**
- Consumes: `parseInput` from `src/shared/validation.ts` (existing).
- Produces: `summaryArgsSchema` (a `z.ZodType` parsing `unknown` into
  `{ month: number; year: number }`), the type alias `SummaryArgs`, and the
  exported bounds `MIN_YEAR = 1970` / `MAX_YEAR = 9999`. Task 2 imports
  `summaryArgsSchema` and `SummaryArgs`; Task 3's integration test imports
  nothing from here.

**Naming note.** The design calls this "a `summaryArgs` zod schema". It is named
`summaryArgsSchema` to match `createCategorySchema`, `transactionPageSchema` and
every other schema in the codebase; `SummaryArgs` is the inferred type, matching
`TransactionPageArgs`. Same object, codebase-consistent name.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/unit/summary-validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseInput } from '../../src/shared/validation.js';
import { summaryArgsSchema } from '../../src/modules/summary/validation.js';

describe('summaryArgsSchema', () => {
  it('accepts a month and year in range', () => {
    expect(parseInput(summaryArgsSchema, { month: 8, year: 2026 })).toEqual({
      month: 8,
      year: 2026,
    });
  });

  it('accepts both month bounds', () => {
    expect(parseInput(summaryArgsSchema, { month: 1, year: 2026 }).month).toBe(1);
    expect(parseInput(summaryArgsSchema, { month: 12, year: 2026 }).month).toBe(
      12,
    );
  });

  it('rejects a month one past either bound', () => {
    expect(() => parseInput(summaryArgsSchema, { month: 0, year: 2026 })).toThrow(
      'O mês deve estar entre 1 e 12',
    );
    expect(() =>
      parseInput(summaryArgsSchema, { month: 13, year: 2026 }),
    ).toThrow('O mês deve estar entre 1 e 12');
  });

  it('rejects a non-integer month', () => {
    // A fractional month reaching Date.UTC produces a window nobody asked for
    // rather than an error.
    expect(() =>
      parseInput(summaryArgsSchema, { month: 8.5, year: 2026 }),
    ).toThrow('O mês deve ser um número inteiro');
  });

  it('accepts both year bounds', () => {
    expect(parseInput(summaryArgsSchema, { month: 1, year: 1970 }).year).toBe(
      1970,
    );
    expect(parseInput(summaryArgsSchema, { month: 1, year: 9999 }).year).toBe(
      9999,
    );
  });

  it('rejects a year one past either bound', () => {
    expect(() =>
      parseInput(summaryArgsSchema, { month: 1, year: 1969 }),
    ).toThrow('O ano deve estar entre 1970 e 9999');
    expect(() =>
      parseInput(summaryArgsSchema, { month: 1, year: 10_000 }),
    ).toThrow('O ano deve estar entre 1970 e 9999');
  });

  it('rejects a non-integer year', () => {
    expect(() =>
      parseInput(summaryArgsSchema, { month: 1, year: 2026.5 }),
    ).toThrow('O ano deve ser um número inteiro');
  });

  it('names the failing field so the client can point at it', () => {
    try {
      parseInput(summaryArgsSchema, { month: 13, year: 2026 });
      throw new Error('should have thrown');
    } catch (error) {
      const extensions = (
        error as { extensions?: { fieldErrors?: Record<string, string[]> } }
      ).extensions;
      expect(extensions?.fieldErrors?.month).toContain(
        'O mês deve estar entre 1 e 12',
      );
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
rtk proxy "npm test -w @financy/backend -- tests/unit/summary-validation.test.ts"
```

Expected: FAIL — `Cannot find module '.../modules/summary/validation.js'`.

- [ ] **Step 3: Write the schema**

Create `apps/backend/src/modules/summary/validation.ts`:

```ts
import { z } from 'zod';

/**
 * The epoch and the largest year `Date.UTC` round-trips through a four-digit
 * DateTime. Both bounds exist to stop a nonsense year reaching a groupBy that
 * would scan, return zeros, and read as "no data" rather than as the input
 * error it is. backend.md section 5.
 */
export const MIN_YEAR = 1970;
export const MAX_YEAR = 9999;

// zod 4 takes the message as `{ error }`; `required_error` is silently ignored.
const month = z
  .int({ error: 'O mês deve ser um número inteiro' })
  .min(1, 'O mês deve estar entre 1 e 12')
  .max(12, 'O mês deve estar entre 1 e 12');

const year = z
  .int({ error: 'O ano deve ser um número inteiro' })
  .min(MIN_YEAR, 'O ano deve estar entre 1970 e 9999')
  .max(MAX_YEAR, 'O ano deve estar entre 1970 e 9999');

export const summaryArgsSchema = z.object({ month, year });

export type SummaryArgs = z.infer<typeof summaryArgsSchema>;
```

- [ ] **Step 4: Run it and watch it pass**

```bash
rtk proxy "npm test -w @financy/backend -- tests/unit/summary-validation.test.ts"
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/backend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add apps/backend/src/modules/summary/validation.ts apps/backend/tests/unit/summary-validation.test.ts
git commit -m "feat(backend): validate summary month and year with zod"
```

---

### Task 2: `getSummary` — the UTC window and the two aggregates

**Files:**
- Create: `apps/backend/src/modules/summary/service.ts`
- Test: `apps/backend/tests/integration/summary.test.ts` (service-level cases;
  Task 3 appends the HTTP-level ones to the same file)

**Interfaces:**
- Consumes: `summaryArgsSchema` from Task 1; `prisma` from
  `src/shared/prisma.js`; `parseInput` from `src/shared/validation.js`.
- Produces:
  ```ts
  export interface Summary {
    totalBalance: number;
    monthIncome: number;
    monthExpense: number;
  }
  export function getSummary(userId: string, args: unknown): Promise<Summary>;
  ```
  Task 3's resolver calls exactly this.

**The decisions this task implements, from the design:**

- The window is built in **UTC** and is **half-open** internally
  (`gte: Date.UTC(year, month - 1, 1)`, `lt: Date.UTC(year, month, 1)`). Half-open
  is what makes "the last instant of the final day" exact without picking a
  millisecond. `Date.UTC(year, 12, 1)` rolls into January of the following year
  on its own, so December needs no special case.
- `monthExpense` is returned **unsigned** — a positive number of cents spent,
  matching `Category.totalAmount`'s convention. The dashboard renders the sign.
- **No DataLoader.** `summary` is a single root field resolved once per request,
  not a per-row field; there is no N+1 to batch.
- Both `groupBy` calls carry `userId` in the `where` clause, and both run inside
  one `prisma.$transaction` so all three figures come from one consistent read.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/integration/summary.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { getSummary } from '../../src/modules/summary/service.js';
import { resetDatabase } from '../helpers/db.js';
import { createTransaction, createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

/** Noon UTC, so no timezone the suite could run under moves the day. */
const utc = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

describe('getSummary', () => {
  it('is all zeros for a user with no transactions', async () => {
    const { user } = await createUser();

    expect(await getSummary(user.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: 0,
      monthIncome: 0,
      monthExpense: 0,
    });
  });

  it('returns a month with no transactions as zeros rather than null', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 5_000,
      type: 'INCOME',
      date: utc(2026, 7, 10),
    });

    expect(await getSummary(user.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: 5_000,
      monthIncome: 0,
      monthExpense: 0,
    });
  });

  it('sums income and expense within the requested month', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 780_000,
      type: 'INCOME',
      date: utc(2026, 8, 5),
    });
    await createTransaction(user.id, {
      amount: 210_000,
      type: 'EXPENSE',
      date: utc(2026, 8, 5),
    });
    await createTransaction(user.id, {
      amount: 34_215,
      type: 'EXPENSE',
      date: utc(2026, 8, 20),
    });

    expect(await getSummary(user.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: 535_785,
      monthIncome: 780_000,
      // Unsigned: the dashboard card renders the minus sign.
      monthExpense: 244_215,
    });
  });

  it('spans months in totalBalance and only the month in the two month figures', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 100_000,
      type: 'INCOME',
      date: utc(2026, 1, 15),
    });
    await createTransaction(user.id, {
      amount: 40_000,
      type: 'EXPENSE',
      date: utc(2026, 12, 15),
    });
    await createTransaction(user.id, {
      amount: 7_000,
      type: 'EXPENSE',
      date: utc(2026, 8, 15),
    });

    expect(await getSummary(user.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: 53_000,
      monthIncome: 0,
      monthExpense: 7_000,
    });
  });

  it('includes both edges of the month and neither neighbour', async () => {
    const { user } = await createUser();
    // The first and last instants of August 2026 in UTC, and the instants one
    // millisecond outside each.
    await prisma.transaction.createMany({
      data: [
        { d: new Date(Date.UTC(2026, 7, 1, 0, 0, 0, 0)), a: 1 },
        { d: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)), a: 2 },
        { d: new Date(Date.UTC(2026, 6, 31, 23, 59, 59, 999)), a: 400 },
        { d: new Date(Date.UTC(2026, 8, 1, 0, 0, 0, 0)), a: 800 },
      ].map(({ d, a }) => ({
        userId: user.id,
        description: 'Limite',
        amount: a,
        type: 'EXPENSE',
        date: d,
      })),
    });

    const summary = await getSummary(user.id, { month: 8, year: 2026 });

    expect(summary.monthExpense).toBe(3);
    expect(summary.totalBalance).toBe(-1_203);
  });

  it('does not leak January of the following year into December', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 900,
      type: 'EXPENSE',
      date: utc(2026, 12, 31),
    });
    await createTransaction(user.id, {
      amount: 500,
      type: 'EXPENSE',
      date: utc(2027, 1, 1),
    });

    expect((await getSummary(user.id, { month: 12, year: 2026 })).monthExpense).toBe(
      900,
    );
  });

  it('does not leak the previous December into January', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 900,
      type: 'EXPENSE',
      date: utc(2025, 12, 31),
    });
    await createTransaction(user.id, {
      amount: 500,
      type: 'EXPENSE',
      date: utc(2026, 1, 1),
    });

    expect((await getSummary(user.id, { month: 1, year: 2026 })).monthExpense).toBe(
      500,
    );
  });

  it('never counts another user rows', async () => {
    // Asserted as the caller's own figures being unchanged, not as NOT_FOUND:
    // summary takes no id, so there is nothing to miss. Same reasoning slice 4
    // recorded for a foreign categoryId in a filter.
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();
    await createTransaction(ana.id, {
      amount: 999_999,
      type: 'INCOME',
      date: utc(2026, 8, 10),
    });
    await createTransaction(bruno.id, {
      amount: 1_000,
      type: 'EXPENSE',
      date: utc(2026, 8, 10),
    });

    expect(await getSummary(bruno.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: -1_000,
      monthIncome: 0,
      monthExpense: 1_000,
    });
  });

  it('rejects an out-of-range month before it reaches Prisma', async () => {
    const { user } = await createUser();

    await expect(getSummary(user.id, { month: 13, year: 2026 })).rejects.toThrow(
      'O mês deve estar entre 1 e 12',
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/summary.test.ts"
```

Expected: FAIL — `Cannot find module '.../modules/summary/service.js'`.

- [ ] **Step 3: Write the service**

Create `apps/backend/src/modules/summary/service.ts`:

```ts
import { prisma } from '../../shared/prisma.js';
import { parseInput } from '../../shared/validation.js';
import { summaryArgsSchema } from './validation.js';

export interface Summary {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
}

interface TypeSum {
  type: string;
  _sum: { amount: number | null };
}

const sumOf = (rows: TypeSum[], type: string) =>
  rows.find((row) => row.type === type)?._sum.amount ?? 0;

/**
 * The requested calendar month as a half-open UTC interval. Half-open is what
 * makes backend.md section 5's "the last instant of the final day" exact
 * without picking a millisecond, and `Date.UTC(year, 12, 1)` rolls into
 * January of the following year on its own, so December needs no special case.
 *
 * UTC, not server-local: a local window makes every figure depend on the TZ the
 * process happens to run under, so the same data reads differently on a
 * developer's machine and a deployed one. The cost — a user at UTC-3 who
 * records a transaction late on the last day of a month sees it counted in the
 * next one — is recorded as a deviation in frontend.md section 12.
 */
function monthWindow(month: number, year: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

/**
 * No DataLoader: this is a single root field resolved once per request, not a
 * per-row field, so there is no N+1 to batch. The two aggregates run inside one
 * $transaction so all three figures come from one consistent read — separately,
 * a write landing between them could produce a balance that no single moment of
 * the database ever held.
 */
export async function getSummary(
  userId: string,
  args: unknown,
): Promise<Summary> {
  const { month, year } = parseInput(summaryArgsSchema, args);
  const date = monthWindow(month, year);

  const [allTime, inMonth] = await prisma.$transaction([
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, date },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalBalance: sumOf(allTime, 'INCOME') - sumOf(allTime, 'EXPENSE'),
    monthIncome: sumOf(inMonth, 'INCOME'),
    // Unsigned, matching Category.totalAmount. The dashboard card renders the
    // minus sign. backend.md section 5.
    monthExpense: sumOf(inMonth, 'EXPENSE'),
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/summary.test.ts"
```

Expected: PASS, 9 tests.

If the `$transaction` tuple destructure does not typecheck, do **not** reach for
a cast — `prisma.$transaction` on an array of two `PrismaPromise`s infers a
tuple, and a failure there means one of the two calls is not a `PrismaPromise`
(usually an `await` that crept in).

- [ ] **Step 5: Gate and commit**

```bash
rtk proxy "npm test -w @financy/backend"
rtk proxy "npm run typecheck -w @financy/backend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add apps/backend/src/modules/summary/service.ts apps/backend/tests/integration/summary.test.ts
git commit -m "feat(backend): aggregate the summary figures over a UTC month window"
```

---

### Task 3: Expose `summary` on the graph

**Files:**
- Create: `apps/backend/src/modules/summary/schema.ts`
- Create: `apps/backend/src/modules/summary/resolvers.ts`
- Modify: `apps/backend/src/schema.ts`
- Regenerate: `apps/backend/schema.graphql`,
  `apps/backend/src/graphql/generated/resolvers.ts`
- Test: `apps/backend/tests/integration/summary.test.ts` (append)

**Interfaces:**
- Consumes: `getSummary` from Task 2; `requireUser` from
  `src/shared/auth-guard.js`; the generated `Resolvers` type.
- Produces: `summaryTypeDefs` (a `/* GraphQL */`-tagged template literal string)
  and `summaryResolvers: Resolvers`. Task 4's frontend codegen reads the
  regenerated `schema.graphql`.

The SDL moves out of `backend.md`'s monolithic listing into the module's tagged
template literal, unchanged. It is a template literal and **not** a `.graphql`
file: codegen plucks it from the magic comment, and a runtime read would force
the build to copy non-TypeScript files into `dist/`.

- [ ] **Step 1: Write the failing test**

Append to `apps/backend/tests/integration/summary.test.ts`. First add the imports
at the top of the file — **merge `beforeAll` into the existing
`from 'vitest'` line** rather than adding a second import from the same module:

```ts
import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
// existing line becomes:
// import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { GraphQLContext } from '../../src/context.js';
import { signToken } from '../../src/shared/jwt.js';
import { errorCode, execute } from '../helpers/graphql.js';

let app: Express;
let apollo: ApolloServer<GraphQLContext>;

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

const SUMMARY = /* GraphQL */ `
  query Summary($month: Int!, $year: Int!) {
    summary(month: $month, year: $year) {
      totalBalance
      monthIncome
      monthExpense
    }
  }
`;

async function signedIn() {
  const { user } = await createUser();
  return { user, token: await signToken(user.id) };
}
```

The existing `afterAll` becomes:

```ts
afterAll(async () => {
  await apollo.stop();
  await prisma.$disconnect();
});
```

Then the new block:

```ts
describe('the summary query', () => {
  it('answers the caller’s three figures', async () => {
    const { user, token } = await signedIn();
    await createTransaction(user.id, {
      amount: 300_000,
      type: 'INCOME',
      date: utc(2026, 8, 5),
    });
    await createTransaction(user.id, {
      amount: 120_000,
      type: 'EXPENSE',
      date: utc(2026, 8, 6),
    });
    await createTransaction(user.id, {
      amount: 50_000,
      type: 'EXPENSE',
      date: utc(2026, 7, 6),
    });

    const body = await execute(app, {
      query: SUMMARY,
      variables: { month: 8, year: 2026 },
      token,
    });

    expect(body.data?.summary).toEqual({
      totalBalance: 130_000,
      monthIncome: 300_000,
      monthExpense: 120_000,
    });
  });

  it('answers zeros, not null and not an error, for an empty month', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: SUMMARY,
      variables: { month: 2, year: 2026 },
      token,
    });

    expect(body.errors).toBeUndefined();
    expect(body.data?.summary).toEqual({
      totalBalance: 0,
      monthIncome: 0,
      monthExpense: 0,
    });
  });

  it('rejects an unauthenticated caller', async () => {
    const body = await execute(app, {
      query: SUMMARY,
      variables: { month: 8, year: 2026 },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });

  it('answers BAD_USER_INPUT for each out-of-range argument', async () => {
    const { token } = await signedIn();

    for (const variables of [
      { month: 0, year: 2026 },
      { month: 13, year: 2026 },
      { month: 8, year: 1969 },
      { month: 8, year: 10_000 },
    ]) {
      const body = await execute(app, { query: SUMMARY, variables, token });
      expect(errorCode(body)).toBe('BAD_USER_INPUT');
    }
  });

  it('never shows one user another user’s figures', async () => {
    const { user: ana } = await createUser();
    const { token } = await signedIn();
    await createTransaction(ana.id, {
      amount: 999_999,
      type: 'INCOME',
      date: utc(2026, 8, 10),
    });

    const body = await execute(app, {
      query: SUMMARY,
      variables: { month: 8, year: 2026 },
      token,
    });

    expect(body.data?.summary).toEqual({
      totalBalance: 0,
      monthIncome: 0,
      monthExpense: 0,
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/summary.test.ts"
```

Expected: FAIL — the new block errors with `Cannot query field "summary" on type
"Query"`. The nine tests from Task 2 still pass.

Also run the schema-artifact test, which is the second thing that must go red
and green in this task:

```bash
rtk proxy "npm test -w @financy/backend -- tests/unit/schema-artifact.test.ts"
```

Expected right now: PASS (nothing has changed yet). It goes red in Step 3 the
moment `src/schema.ts` registers the module, and green again after codegen — that
transition is what proves the committed artifact is regenerated rather than
stale.

- [ ] **Step 3: Write the module SDL and the resolver**

Create `apps/backend/src/modules/summary/schema.ts`:

```ts
export const summaryTypeDefs = /* GraphQL */ `
  type Summary {
    "All-time income minus expense, in cents. Can be negative."
    totalBalance: Int!
    "Income within the requested month, in cents."
    monthIncome: Int!
    "Expense within the requested month, in cents, unsigned."
    monthExpense: Int!
  }

  extend type Query {
    "The month window is built in UTC. backend.md section 5."
    summary(month: Int!, year: Int!): Summary!
  }
`;
```

Create `apps/backend/src/modules/summary/resolvers.ts`:

```ts
import type { Resolvers } from '../../graphql/generated/resolvers.js';
import { requireUser } from '../../shared/auth-guard.js';
import { getSummary } from './service.js';

export const summaryResolvers: Resolvers = {
  Query: {
    summary: (_parent, args, context) => getSummary(requireUser(context), args),
  },
};
```

Modify `apps/backend/src/schema.ts` — add the two imports beside the existing
module imports:

```ts
import { summaryTypeDefs } from './modules/summary/schema.js';
import { summaryResolvers } from './modules/summary/resolvers.js';
```

add `summaryTypeDefs` to the `typeDefs` array, after `transactionTypeDefs`:

```ts
export const typeDefs = [
  rootTypeDefs,
  authTypeDefs,
  categoryTypeDefs,
  transactionTypeDefs,
  summaryTypeDefs,
];
```

and add the spread to `Query`, after the transaction one:

```ts
    ...(summaryResolvers.Query ?? {}),
```

- [ ] **Step 4: Regenerate, then run**

```bash
rtk proxy "npm run codegen -w @financy/backend"
rtk proxy "npm test -w @financy/backend"
```

Expected: PASS — 14 tests in `summary.test.ts` (Task 2's nine plus this task's
five) and the schema-artifact test green again. `git status` should show `schema.graphql` and
`src/graphql/generated/resolvers.ts` modified.

- [ ] **Step 5: Gate and commit**

`git add` **before** `codegen:check` — it diffs against the index, not the
working tree.

```bash
git add apps/backend/src/modules/summary apps/backend/src/schema.ts apps/backend/schema.graphql apps/backend/src/graphql/generated apps/backend/tests/integration/summary.test.ts
rtk proxy "npm run codegen:check -w @financy/backend"
rtk proxy "npm run typecheck -w @financy/backend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git commit -m "feat(backend): expose the summary query on the graph"
```

`format:check` must not touch `schema.graphql` — it is in `.prettierignore`. If
Prettier reports it, something removed the ignore entry; restore it rather than
formatting the file.

---

### Task 4: The `Summary` operation and the query key that makes two dead invalidations live

**Files:**
- Create: `apps/frontend/src/graphql/operations/summary.graphql`
- Modify: `apps/frontend/src/graphql/operations/categories.graphql`
- Modify: `apps/frontend/src/lib/period.ts`
- Regenerate: `apps/frontend/src/graphql/generated/graphql.ts`
- Test: `apps/frontend/src/graphql/generated/query-keys.test.ts` (append),
  `apps/frontend/src/lib/period.test.ts` (append)

**Interfaces:**
- Consumes: `apps/backend/schema.graphql` as committed by Task 3.
- Produces, for Tasks 5–8:
  - `useSummaryQuery(variables: SummaryQueryVariables)` and
    `useSummaryQuery.getKey(variables)` from `@/graphql/generated/graphql`,
    keyed `['Summary', { month, year }]`.
  - `SummaryQuery` / `SummaryQueryVariables` types.
  - `Categories` query now selects `totalAmount`, so
    `CategoriesQuery['categories'][number]` carries `totalAmount: number`.
  - `currentPeriod(now?: Date): { month: number; year: number }` from
    `@/lib/period`.

**Why the key matters.** `TransactionDialog.tsx:101` and
`DeleteTransactionDialog.tsx:52` already call
`invalidateQueries({ queryKey: ['Summary'] })`. Slices 3 and 4 both recorded that
as an invalidation with no consumer. Naming this operation `Summary` makes both
start working by prefix match — **no change to either file** — and this task's
test is the first thing that could ever have caught the literal being wrong.

**Why `Categories` changes.** `categories.graphql` deliberately omits
`totalAmount` ("the dashboard panel in slice 5 is what renders it"). Task 7
renders it, so it is selected now. The field is added to the one shared
`Categories` document rather than a second dashboard-only document: a second
document is a second cache entry for the same rows, and the mutations invalidate
by operation name.

- [ ] **Step 1: Write the failing tests**

Append to `apps/frontend/src/graphql/generated/query-keys.test.ts` — and extend
its import:

```ts
import { useMeQuery, useSummaryQuery } from './graphql';
```

```ts
describe('the summary query key', () => {
  // TransactionDialog.tsx and DeleteTransactionDialog.tsx both invalidate the
  // bare literal ['Summary']. TanStack matches by prefix, so this is the test
  // that proves those two calls reach the dashboard's cache entry instead of
  // being the silent no-ops slices 3 and 4 both recorded.
  it('keys on the operation name and its variables', () => {
    expect(useSummaryQuery.getKey({ month: 8, year: 2026 })).toEqual([
      'Summary',
      { month: 8, year: 2026 },
    ]);
  });

  it('starts with the literal the mutation dialogs invalidate', () => {
    expect(useSummaryQuery.getKey({ month: 1, year: 2026 })[0]).toBe('Summary');
  });
});
```

Append to `apps/frontend/src/lib/period.test.ts`:

```ts
describe('currentPeriod', () => {
  // `now` is a parameter for the same reason periodOptions takes one: the
  // tests must not be written against the wall clock.
  it('reads the month as 1-12, not as the zero-based index', () => {
    expect(currentPeriod(new Date(2026, 7, 15))).toEqual({
      month: 8,
      year: 2026,
    });
  });

  it('reports December as 12 and January as 1', () => {
    expect(currentPeriod(new Date(2026, 11, 31))).toEqual({
      month: 12,
      year: 2026,
    });
    expect(currentPeriod(new Date(2027, 0, 1))).toEqual({
      month: 1,
      year: 2027,
    });
  });

  it('reads the browser’s local time, which is what the cards ask for', () => {
    // TZ is pinned to America/Sao_Paulo, so this instant is 31 December
    // locally and 1 January in UTC. The dashboard asks for the local month;
    // the server windows it in UTC. frontend.md section 12 records the gap.
    expect(currentPeriod(new Date('2027-01-01T02:00:00.000Z'))).toEqual({
      month: 12,
      year: 2026,
    });
  });
});
```

Extend that file's existing import — line 2 is
`import { ALL_PERIODS, periodOptions, periodRange } from '@/lib/period';` — to
include `currentPeriod`.

- [ ] **Step 2: Run them and watch them fail**

```bash
rtk proxy "npm test -w @financy/frontend -- src/graphql/generated/query-keys.test.ts src/lib/period.test.ts"
```

Expected: FAIL — `useSummaryQuery` and `currentPeriod` are not exported.

- [ ] **Step 3: Write the operation, the field and the helper**

Create `apps/frontend/src/graphql/operations/summary.graphql`:

```graphql
# Named `Summary` deliberately: TransactionDialog.tsx and
# DeleteTransactionDialog.tsx have invalidated the literal ['Summary'] since
# slice 3, with nothing to invalidate. Codegen keys a query on its operation
# name, so this name is what makes those two calls do something.
query Summary($month: Int!, $year: Int!) {
  summary(month: $month, year: $year) {
    totalBalance
    monthIncome
    monthExpense
  }
}
```

Modify `apps/frontend/src/graphql/operations/categories.graphql` — replace the
leading comment and add the field:

```graphql
# totalAmount is selected for the dashboard's "Categorias" panel, which sorts by
# it. The categories page's card shows an item count and no money and simply
# does not read it — one document rather than two, because a second document is
# a second cache entry for the same rows and the mutations invalidate by
# operation name.
query Categories {
  categories {
    id
    name
    description
    icon
    color
    transactionCount
    totalAmount
  }
}
```

Append to `apps/frontend/src/lib/period.ts`:

```ts
/**
 * The month the dashboard's stat cards ask `summary(month, year)` for, read
 * from the browser's local time. The server windows that month in UTC, so on
 * the last day of a month in a negative-offset zone the two disagree for a few
 * hours — recorded as a deviation in frontend.md section 12.
 *
 * `now` is a parameter so the tests are not written against the wall clock,
 * like periodOptions above.
 */
export function currentPeriod(now: Date = new Date()): {
  month: number;
  year: number;
} {
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}
```

- [ ] **Step 4: Regenerate, then run**

```bash
rtk proxy "npm run codegen -w @financy/frontend"
rtk proxy "npm test -w @financy/frontend -- src/graphql/generated/query-keys.test.ts src/lib/period.test.ts"
```

Expected: PASS.

**If the key assertion fails**, open the regenerated
`src/graphql/generated/graphql.ts` and read what `useSummaryQuery.getKey`
actually returns before changing anything. For an operation whose variables are
all required, the plugin emits `['Summary', variables]` with no
`variables === undefined` branch — that is what this task assumes. If the output
differs, the **test** is what gets corrected to match the generated code, and the
first element must still be the string `'Summary'`; if that first element is not
`'Summary'`, stop — the two dialogs' invalidations cannot work and the operation
name is what is wrong.

- [ ] **Step 5: Gate and commit**

```bash
git add apps/frontend/src/graphql apps/frontend/src/lib/period.ts apps/frontend/src/lib/period.test.ts
rtk proxy "npm run codegen:check -w @financy/frontend"
rtk proxy "npm test -w @financy/frontend"
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git commit -m "feat(frontend): generate the Summary query and the current period helper"
```

The full frontend suite is run here because adding `totalAmount` to the shared
`Categories` document touches every screen that queries it.

---

### Task 5: The dashboard screen and its three stat cards

**Files:**
- Create: `apps/frontend/src/features/dashboard/DashboardPage.tsx`
- Test: `apps/frontend/src/features/dashboard/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useSummaryQuery`, `currentPeriod`, `centsToDisplay`,
  `formatSignedAmount`, `PageShell`, `StatCard`, `Skeleton`, `PanelError`.
- Produces: `export function DashboardPage(): JSX.Element`. Task 8 adds the two
  panels and the dialog to this same component and mounts it in `routes.tsx`.

This task builds the screen with **only** the stat cards. The panels arrive as
their own components in Tasks 6 and 7 and are composed in in Task 8, so each of
the three sections gets its own reviewable test cycle.

**Two design points resolved here.**

**[design correction 1]** The design's states table says the empty state is
`R$ 0,00` **on all three** cards, and separately says "Despesas do mês" renders
through `formatSignedAmount(monthExpense, 'EXPENSE')`. Taken together those
produce `-R$ 0,00` for a new user. The sign is applied only to a non-zero
expense; zero renders as plain `R$ 0,00`, which is what the table asks for.

**[design correction 2]** The design names `formatSignedAmount` only for
"Despesas do mês", so "Receitas do mês" renders through `centsToDisplay` with no
`+`. That is also what keeps the empty state `R$ 0,00` on all three.

`totalBalance` is signed and `centsToDisplay` already renders its minus sign.

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/features/dashboard/DashboardPage.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { currentPeriod } from '@/lib/period';
import { DashboardPage } from './DashboardPage';

function mockSummary(
  summary: { totalBalance: number; monthIncome: number; monthExpense: number },
) {
  server.use(api.query('Summary', () => ok({ summary })));
}

beforeEach(() => {
  // MSW is strict, so the shell's own query has to be mocked on every render.
  server.use(api.query('Me', () => ok({ me: aUser })));
});

describe('DashboardPage stat cards', () => {
  it('announces that it is loading before the figures arrive', () => {
    mockSummary({ totalBalance: 0, monthIncome: 0, monthExpense: 0 });
    renderWithProviders(<DashboardPage />);

    expect(
      screen.getByRole('status', { name: 'Carregando resumo' }),
    ).toBeInTheDocument();
  });

  it('renders the three figures as Brazilian currency', async () => {
    mockSummary({
      totalBalance: 535_785,
      monthIncome: 780_000,
      monthExpense: 244_215,
    });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('R$ 5.357,85')).toBeInTheDocument();
    expect(screen.getByText('R$ 7.800,00')).toBeInTheDocument();
    // The API figure is unsigned; the card renders the minus sign.
    expect(screen.getByText('-R$ 2.442,15')).toBeInTheDocument();
    expect(screen.getByText('Saldo total')).toBeInTheDocument();
    expect(screen.getByText('Receitas do mês')).toBeInTheDocument();
    expect(screen.getByText('Despesas do mês')).toBeInTheDocument();
  });

  it('renders a negative balance with its minus sign', async () => {
    mockSummary({ totalBalance: -12_345, monthIncome: 0, monthExpense: 12_345 });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('-R$ 123,45')).toBeInTheDocument();
  });

  it('shows a real zero rather than a special empty state', async () => {
    // A new user's balance genuinely is zero, and a "no data yet" card could
    // not be told apart from a real zero balance.
    mockSummary({ totalBalance: 0, monthIncome: 0, monthExpense: 0 });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findAllByText('R$ 0,00')).toHaveLength(3);
  });

  it('asks for the current month and year', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Summary', ({ variables: received }) => {
        variables(received);
        return ok({
          summary: { totalBalance: 0, monthIncome: 0, monthExpense: 0 },
        });
      }),
    );
    renderWithProviders(<DashboardPage />);

    await waitFor(() =>
      expect(variables).toHaveBeenCalledWith(currentPeriod()),
    );
    const asked = variables.mock.calls[0]![0] as {
      month: number;
      year: number;
    };
    expect(asked.month).toBe(new Date().getMonth() + 1);
    expect(asked.year).toBe(new Date().getFullYear());
  });

  it('offers a retry when the summary fails, and the retry refetches', async () => {
    let calls = 0;
    server.use(
      api.query('Summary', () => {
        calls += 1;
        return calls === 1
          ? graphqlError('NOT_FOUND')
          : ok({
              summary: {
                totalBalance: 100,
                monthIncome: 100,
                monthExpense: 0,
              },
            });
      }),
    );
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o resumo',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('R$ 1,00')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/dashboard/DashboardPage.test.tsx"
```

Expected: FAIL — `Failed to resolve import "./DashboardPage"`.

- [ ] **Step 3: Write the screen**

Create `apps/frontend/src/features/dashboard/DashboardPage.tsx`:

```tsx
import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useSummaryQuery } from '@/graphql/generated/graphql';
import { centsToDisplay, formatSignedAmount } from '@/lib/currency';
import { currentPeriod } from '@/lib/period';

export function DashboardPage() {
  // Read once per mount, not per render. The period is part of a query key, and
  // recomputing it every render would mint a new key the moment the clock rolls
  // past midnight on the last day of a month with the tab still open.
  const [period] = useState(currentPeriod);
  const summary = useSummaryQuery(period);
  const figures = summary.data?.summary;

  return (
    <PageShell title="Dashboard" subtitle="Sua visão geral do mês">
      {summary.isPending ? (
        <Skeleton
          label="Carregando resumo"
          count={3}
          className="h-24 p-5"
          containerClassName="grid gap-4 sm:grid-cols-3"
        />
      ) : summary.isError || !figures ? (
        <PanelError
          message="Não foi possível carregar o resumo"
          onRetry={() => void summary.refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* No separate empty state. A new user's balance genuinely is zero,
              and a "no data yet" card would have to be distinguished from a
              real zero, which the data cannot do. */}
          <StatCard
            icon={Wallet}
            label="Saldo total"
            value={centsToDisplay(figures.totalBalance)}
          />
          <StatCard
            icon={ArrowUpCircle}
            label="Receitas do mês"
            value={centsToDisplay(figures.monthIncome)}
            iconClassName="text-success"
          />
          <StatCard
            icon={ArrowDownCircle}
            label="Despesas do mês"
            // The API figure is unsigned, so the sign is applied here — except
            // at zero, where "-R$ 0,00" would be the only card in the row not
            // reading as the plain zero it is.
            value={
              figures.monthExpense === 0
                ? centsToDisplay(0)
                : formatSignedAmount(figures.monthExpense, 'EXPENSE')
            }
            iconClassName="text-danger"
          />
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/dashboard/DashboardPage.test.tsx"
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add apps/frontend/src/features/dashboard
git commit -m "feat(frontend): render the dashboard stat cards from the summary query"
```

---

### Task 6: The "Transações recentes" panel

**Files:**
- Create: `apps/frontend/src/features/dashboard/RecentTransactionsPanel.tsx`
- Test: `apps/frontend/src/features/dashboard/RecentTransactionsPanel.test.tsx`

**Interfaces:**
- Consumes: `useTransactionsQuery` (existing operation, unchanged),
  `CategoryBadge`, `Tag`, `TypeIndicator`, `TextLink`, `Button`, `Card`,
  `Skeleton`, `PanelError`, `formatSignedAmount`, `formatShortDate`, `cn`.
- Produces:
  ```ts
  export const RECENT_LIMIT = 5;
  export interface RecentTransactionsPanelProps { onCreate: () => void }
  export function RecentTransactionsPanel(props): JSX.Element
  ```
  Task 8 renders it and supplies `onCreate`.

**Why it reuses `Transactions`.** Its default ordering is already
`date DESC, createdAt DESC`, which is exactly "the five most recent". A
`recentTransactions` field returning the same rows in the same order is a second
thing to keep correct.

**Why the panel does not own the dialog.** `onCreate` is a prop, so
`DashboardPage` owns one dialog for the whole screen rather than the panel owning
one nobody else can open.

**Markup notes.** The rows reuse what `TransactionRow.tsx` renders —
`CategoryBadge`, description, `formatShortDate`, the category `Tag` (or the
neutral "Sem categoria" tag), `TypeIndicator` and the signed amount — but they
are `<li>`s in a stacked list, not `<td>`s in a six-column table, and they carry
no edit or delete buttons. Nothing comes out identical, so nothing is extracted:
a near-copy behind a `variant` prop is worse than two small components. The
category tag is the **category** tag, never a type tag — `frontend.md` §12
already records that deviation.

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/features/dashboard/RecentTransactionsPanel.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, graphqlError, ok } from '@/test/msw/api';
import { RecentTransactionsPanel } from './RecentTransactionsPanel';

function aTransaction(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `transaction-${index}`,
    description: `Transação ${index}`,
    amount: 1_000 * index,
    type: 'EXPENSE',
    date: `2026-08-${String(index).padStart(2, '0')}T03:00:00.000Z`,
    category: {
      id: 'category-1',
      name: 'Mercado',
      icon: 'SHOPPING_CART',
      color: 'GREEN',
    },
    ...overrides,
  };
}

function mockRecent(items: unknown[]) {
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items, totalCount: items.length } }),
    ),
  );
}

const noop = () => {};

describe('RecentTransactionsPanel', () => {
  it('announces that it is loading before the rows arrive', () => {
    mockRecent([]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(
      screen.getByRole('status', { name: 'Carregando transações recentes' }),
    ).toBeInTheDocument();
  });

  it('renders the rows it was given, in a named section', async () => {
    mockRecent([aTransaction(1), aTransaction(2)]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
    expect(screen.getByText('Transação 2')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Transações recentes' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('asks for exactly five rows', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({
          transactions: { items: [aTransaction(1)], totalCount: 1 },
        });
      }),
    );
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);
    await screen.findByText('Transação 1');

    expect(variables).toHaveBeenCalledWith({ limit: 5, offset: 0 });
  });

  it('renders the date, the signed amount and the category tag', async () => {
    mockRecent([
      aTransaction(4, { amount: 244_215, type: 'EXPENSE' }),
    ]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByText('-R$ 2.442,15')).toBeInTheDocument();
    expect(screen.getByText('04/08/26')).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('Saída')).toBeInTheDocument();
  });

  it('renders an income row with a plus sign', async () => {
    mockRecent([aTransaction(1, { amount: 780_000, type: 'INCOME' })]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByText('+R$ 7.800,00')).toBeInTheDocument();
    expect(screen.getByText('Entrada')).toBeInTheDocument();
  });

  it('renders an uncategorized row with the neutral tag', async () => {
    mockRecent([aTransaction(1, { category: null })]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByText('Sem categoria')).toBeInTheDocument();
  });

  it('says so when there is nothing yet, and still offers the create action', async () => {
    mockRecent([]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(
      await screen.findByText('Nenhuma transação ainda'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ Nova transação' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the query fails, and the retry refetches', async () => {
    let calls = 0;
    server.use(
      api.query('Transactions', () => {
        calls += 1;
        return calls === 1
          ? graphqlError('NOT_FOUND')
          : ok({
              transactions: { items: [aTransaction(1)], totalCount: 1 },
            });
      }),
    );
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as transações',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
  });

  it('calls onCreate from the footer button', async () => {
    const onCreate = vi.fn();
    mockRecent([]);
    renderWithProviders(<RecentTransactionsPanel onCreate={onCreate} />);
    await screen.findByText('Nenhuma transação ainda');

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova transação' }),
    );

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('links to the full ledger', async () => {
    mockRecent([]);
    renderWithProviders(<RecentTransactionsPanel onCreate={noop} />);
    await screen.findByText('Nenhuma transação ainda');

    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/transactions',
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/dashboard/RecentTransactionsPanel.test.tsx"
```

Expected: FAIL — `Failed to resolve import "./RecentTransactionsPanel"`.

- [ ] **Step 3: Write the panel**

Create `apps/frontend/src/features/dashboard/RecentTransactionsPanel.tsx`:

```tsx
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tag } from '@/components/ui/Tag';
import { TextLink } from '@/components/ui/TextLink';
import { TypeIndicator } from '@/components/ui/TypeIndicator';
import { useTransactionsQuery } from '@/graphql/generated/graphql';
import { formatSignedAmount } from '@/lib/currency';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Five, as frontend.md section 5 specifies. */
export const RECENT_LIMIT = 5;

export interface RecentTransactionsPanelProps {
  /** Opens the screen's one transaction dialog. Owned by DashboardPage. */
  onCreate: () => void;
}

/**
 * Reuses the paginated `Transactions` query rather than a dedicated field: its
 * default ordering is already date DESC, createdAt DESC, which is exactly "the
 * five most recent". A second field returning the same rows in the same order
 * would be a second thing to keep correct.
 */
export function RecentTransactionsPanel({
  onCreate,
}: RecentTransactionsPanelProps) {
  const transactions = useTransactionsQuery({
    limit: RECENT_LIMIT,
    offset: 0,
  });
  const items = transactions.data?.transactions.items;

  return (
    <Card
      as="section"
      aria-labelledby="recent-transactions-title"
      className="flex flex-col"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2
          id="recent-transactions-title"
          className="font-semibold text-gray-800"
        >
          Transações recentes
        </h2>
        <TextLink to="/transactions">Ver todas</TextLink>
      </div>

      <div className="flex-1 p-5">
        {transactions.isPending ? (
          <Skeleton
            label="Carregando transações recentes"
            count={RECENT_LIMIT}
            className="h-12"
            containerClassName="flex flex-col gap-2"
          />
        ) : transactions.isError || !items ? (
          <PanelError
            message="Não foi possível carregar as transações"
            onRetry={() => void transactions.refetch()}
          />
        ) : items.length === 0 ? (
          // The action that fixes it is the footer button below, which stays
          // mounted in every state.
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhuma transação ainda
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((transaction) => (
              <li key={transaction.id} className="flex items-center gap-3">
                {/* Both fall back to neutral when there is no category — a
                    transaction can be created without one and can lose one
                    when its category is deleted. frontend.md section 12. */}
                <CategoryBadge
                  icon={transaction.category?.icon}
                  color={transaction.category?.color}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">
                    {transaction.description}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatShortDate(transaction.date)}
                  </p>
                </div>

                {/* The category tag, never a type tag: the type is already
                    carried by the arrow and the sign. frontend.md section 12. */}
                <Tag color={transaction.category?.color}>
                  {transaction.category?.name ?? 'Sem categoria'}
                </Tag>

                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      transaction.type === 'INCOME'
                        ? 'text-success'
                        : 'text-danger',
                    )}
                  >
                    {formatSignedAmount(transaction.amount, transaction.type)}
                  </span>
                  <TypeIndicator type={transaction.type} className="text-xs" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-gray-200 px-5 py-4">
        <Button variant="secondary" className="w-full" onClick={onCreate}>
          + Nova transação
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/dashboard/RecentTransactionsPanel.test.tsx"
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add apps/frontend/src/features/dashboard
git commit -m "feat(frontend): add the recent transactions dashboard panel"
```

---

### Task 7: The "Categorias" panel

**Files:**
- Create: `apps/frontend/src/features/dashboard/CategoriesPanel.tsx`
- Test: `apps/frontend/src/features/dashboard/CategoriesPanel.test.tsx`

**Interfaces:**
- Consumes: `useCategoriesQuery` (now selecting `totalAmount`, from Task 4),
  `CategoryBadge`, `Tag`, `TextLink`, `Card`, `Skeleton`, `PanelError`,
  `centsToDisplay`.
- Produces:
  ```ts
  export const CATEGORY_LIMIT = 5;
  export function CategoriesPanel(): JSX.Element
  ```
  It takes no props. Task 8 renders it.

**Why the sort is on the client.** `categories` returns a plain unpaginated list
precisely because it is small (`backend.md` §5), so the sort costs nothing and no
new argument is needed. `Array.prototype.sort` is stable, so categories with
equal totals keep the server's alphabetical order and two renders of the same
data cannot disagree.

The item count copy is `1 item` / `N itens`, matching `CategoryCard.tsx:65`.

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/features/dashboard/CategoriesPanel.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, graphqlError, ok } from '@/test/msw/api';
import { CategoriesPanel } from './CategoriesPanel';

function aCategory(
  name: string,
  totalAmount: number,
  transactionCount = 3,
) {
  return {
    id: `category-${name}`,
    name,
    description: null,
    icon: 'SHOPPING_CART',
    color: 'GREEN',
    transactionCount,
    totalAmount,
  };
}

function mockCategories(categories: unknown[]) {
  server.use(api.query('Categories', () => ok({ categories })));
}

describe('CategoriesPanel', () => {
  it('announces that it is loading before the rows arrive', () => {
    mockCategories([]);
    renderWithProviders(<CategoriesPanel />);

    expect(
      screen.getByRole('status', { name: 'Carregando categorias' }),
    ).toBeInTheDocument();
  });

  it('renders a row with its tag, item count and total', async () => {
    mockCategories([aCategory('Mercado', 123_456, 7)]);
    renderWithProviders(<CategoriesPanel />);

    expect(await screen.findByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('7 itens')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.234,56')).toBeInTheDocument();
  });

  it('says "1 item" in the singular', async () => {
    mockCategories([aCategory('Lazer', 1_000, 1)]);
    renderWithProviders(<CategoriesPanel />);

    expect(await screen.findByText('1 item')).toBeInTheDocument();
  });

  it('sorts by total amount descending and caps at five', async () => {
    // Six categories, supplied out of order, so the sort and the cap can fail
    // independently: an unsorted implementation drops the wrong one, and an
    // uncapped one renders six.
    mockCategories([
      aCategory('Terceira', 300),
      aCategory('Sexta', 60),
      aCategory('Primeira', 600),
      aCategory('Quinta', 100),
      aCategory('Segunda', 500),
      aCategory('Quarta', 200),
    ]);
    renderWithProviders(<CategoriesPanel />);

    await screen.findByText('Primeira');
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => within(row).getByRole('heading').textContent)).toEqual([
      'Primeira',
      'Segunda',
      'Terceira',
      'Quarta',
      'Quinta',
    ]);
    expect(screen.queryByText('Sexta')).not.toBeInTheDocument();
  });

  it('says so when there is nothing yet, and still offers the way out', async () => {
    mockCategories([]);
    renderWithProviders(<CategoriesPanel />);

    expect(
      await screen.findByText('Nenhuma categoria ainda'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gerenciar' })).toHaveAttribute(
      'href',
      '/categories',
    );
  });

  it('offers a retry when the query fails, and the retry refetches', async () => {
    let calls = 0;
    server.use(
      api.query('Categories', () => {
        calls += 1;
        return calls === 1
          ? graphqlError('NOT_FOUND')
          : ok({ categories: [aCategory('Mercado', 1_000)] });
      }),
    );
    renderWithProviders(<CategoriesPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as categorias',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Mercado')).toBeInTheDocument();
  });

  it('is a section a screen reader can address by name', async () => {
    mockCategories([aCategory('Mercado', 1_000)]);
    renderWithProviders(<CategoriesPanel />);

    expect(
      await screen.findByRole('region', { name: 'Categorias' }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/dashboard/CategoriesPanel.test.tsx"
```

Expected: FAIL — `Failed to resolve import "./CategoriesPanel"`.

- [ ] **Step 3: Write the panel**

Create `apps/frontend/src/features/dashboard/CategoriesPanel.tsx`:

```tsx
import { Card } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tag } from '@/components/ui/Tag';
import { TextLink } from '@/components/ui/TextLink';
import { useCategoriesQuery } from '@/graphql/generated/graphql';
import { centsToDisplay } from '@/lib/currency';

/** Five, as frontend.md section 5 specifies. */
export const CATEGORY_LIMIT = 5;

export function CategoriesPanel() {
  const categories = useCategoriesQuery();
  const all = categories.data?.categories;

  // Sorted and capped on the client: `categories` returns the whole list
  // precisely because it is small (backend.md section 5), so this costs nothing
  // and needs no new argument. Array.prototype.sort is stable, so categories
  // with equal totals keep the server's alphabetical order rather than
  // reshuffling between renders. Copied first — sort mutates, and the array
  // belongs to the query cache.
  const top = all
    ? [...all]
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, CATEGORY_LIMIT)
    : undefined;

  return (
    <Card
      as="section"
      aria-labelledby="dashboard-categories-title"
      className="flex flex-col"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2
          id="dashboard-categories-title"
          className="font-semibold text-gray-800"
        >
          Categorias
        </h2>
        <TextLink to="/categories">Gerenciar</TextLink>
      </div>

      <div className="flex-1 p-5">
        {categories.isPending ? (
          <Skeleton
            label="Carregando categorias"
            count={CATEGORY_LIMIT}
            className="h-12"
            containerClassName="flex flex-col gap-2"
          />
        ) : categories.isError || !top ? (
          <PanelError
            message="Não foi possível carregar as categorias"
            onRetry={() => void categories.refetch()}
          />
        ) : top.length === 0 ? (
          // The way out is the "Gerenciar" link above, which stays mounted in
          // every state.
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhuma categoria ainda
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {top.map((category) => (
              <li key={category.id} className="flex items-center gap-3">
                <CategoryBadge icon={category.icon} color={category.color} />

                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-gray-800">
                    {category.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {category.transactionCount === 1
                      ? '1 item'
                      : `${category.transactionCount} itens`}
                  </p>
                </div>

                <Tag color={category.color}>{category.name}</Tag>

                <span className="text-sm font-semibold text-gray-800">
                  {centsToDisplay(category.totalAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
```

Note the count string is a template literal in **text content**, not a class
name — the Tailwind rule is about class names only.

- [ ] **Step 4: Run it and watch it pass**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/dashboard/CategoriesPanel.test.tsx"
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add apps/frontend/src/features/dashboard
git commit -m "feat(frontend): add the categories dashboard panel"
```

---

### Task 8: Compose the screen, mount the route, and prove the invalidation

**Files:**
- Modify: `apps/frontend/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/frontend/src/routes.tsx`
- Modify: `apps/frontend/src/routes.test.tsx`
- Test: `apps/frontend/src/features/dashboard/DashboardPage.test.tsx` (append)

**Interfaces:**
- Consumes: `RecentTransactionsPanel` (Task 6), `CategoriesPanel` (Task 7),
  `TransactionDialog` and its `TransactionFormTarget` type from
  `@/features/transactions/TransactionDialog`.
- Produces: nothing new. `DashboardPage` gains the panel row and the dialog;
  `routes.tsx` loses `Placeholder`.

**This task's central test** — creating a transaction from the dashboard's footer
button refetches **all three** sections — is the one test in this slice that must
be **seen to fail first**. Until Task 4 named the operation `Summary`, the two
dialogs' `['Summary']` invalidations were no-ops, and nothing in four slices
could have caught it.

**`routes.test.tsx` must change.** Its `signedIn()` helper mocks only `Me`. The
moment `/` renders `DashboardPage`, MSW's `onUnhandledRequest: 'error'` fails the
two tests that visit the dashboard. `server.use` **prepends**, so defaults added
inside `signedIn()` are still overridden by any later `server.use` in the
`/transactions` test.

- [ ] **Step 1: Write the failing tests**

Append to `apps/frontend/src/features/dashboard/DashboardPage.test.tsx`. Extend
its `beforeEach` so all three sections are mocked for the composition tests:

```tsx
const EMPTY_SUMMARY = { totalBalance: 0, monthIncome: 0, monthExpense: 0 };

function mockAllSections() {
  server.use(api.query('Summary', () => ok({ summary: EMPTY_SUMMARY })));
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items: [], totalCount: 0 } }),
    ),
  );
  server.use(api.query('Categories', () => ok({ categories: [] })));
}

describe('DashboardPage composition', () => {
  it('renders all three sections', async () => {
    mockAllSections();
    renderWithProviders(<DashboardPage />);

    expect(
      await screen.findByRole('region', { name: 'Transações recentes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Categorias' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Saldo total')).toBeInTheDocument();
  });

  it('keeps the other two sections alive when one fails', async () => {
    server.use(api.query('Summary', () => graphqlError('NOT_FOUND')));
    server.use(
      api.query('Transactions', () =>
        ok({ transactions: { items: [], totalCount: 0 } }),
      ),
    );
    server.use(api.query('Categories', () => ok({ categories: [] })));
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o resumo',
    );
    expect(
      screen.getByRole('region', { name: 'Transações recentes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Categorias' }),
    ).toBeInTheDocument();
  });

  it('opens the transaction dialog from the panel footer', async () => {
    mockAllSections();
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Nenhuma transação ainda');

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova transação' }),
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('refetches all three sections after a transaction is created', async () => {
    // The test this slice exists to make possible. TransactionDialog has
    // invalidated ['Summary'] since slice 3 with nothing listening; if the
    // generated key were anything but ['Summary', variables], the stat cards
    // would keep showing pre-create figures and nothing would say so.
    const summaryCalls = vi.fn();
    const transactionCalls = vi.fn();
    const categoryCalls = vi.fn();

    server.use(
      api.query('Summary', () => {
        summaryCalls();
        return ok({ summary: EMPTY_SUMMARY });
      }),
      api.query('Transactions', () => {
        transactionCalls();
        return ok({ transactions: { items: [], totalCount: 0 } });
      }),
      api.query('Categories', () => {
        categoryCalls();
        return ok({ categories: [] });
      }),
      api.query('CategoryStats', () =>
        ok({
          categoryStats: {
            totalCategories: 0,
            totalTransactions: 0,
            mostUsed: null,
          },
        }),
      ),
      api.mutation('CreateTransaction', () =>
        ok({ createTransaction: { id: 'transaction-1' } }),
      ),
    );

    renderWithProviders(<DashboardPage />);
    await screen.findByText('Nenhuma transação ainda');
    await waitFor(() => expect(summaryCalls).toHaveBeenCalledTimes(1));
    const before = {
      summary: summaryCalls.mock.calls.length,
      transactions: transactionCalls.mock.calls.length,
      categories: categoryCalls.mock.calls.length,
    };

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova transação' }),
    );
    await userEvent.type(
      await screen.findByLabelText('Descrição'),
      'Café',
    );
    await userEvent.type(screen.getByLabelText('Valor'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(summaryCalls.mock.calls.length).toBeGreaterThan(before.summary);
      expect(transactionCalls.mock.calls.length).toBeGreaterThan(
        before.transactions,
      );
      expect(categoryCalls.mock.calls.length).toBeGreaterThan(
        before.categories,
      );
    });
  });
});
```

**Before writing this test, open `TransactionDialog.tsx` and read the actual
field labels and the submit button's text**, and use those. The names above
(`Descrição`, `Valor`, `Salvar`) are the expected ones; if the dialog labels
differ, the test uses the dialog's real labels — `TransactionDialog.test.tsx`
already drives this form and is the reference.

Modify `apps/frontend/src/routes.test.tsx` — extend `signedIn()`:

```tsx
function signedIn() {
  writeToken('token', true);
  server.use(api.query('Me', () => ok({ me: aUser })));
  // The root route now renders the real dashboard, whose three sections all
  // fetch. MSW is strict, so every one of them needs a handler; `server.use`
  // prepends, so a later, more specific handler in a single test still wins.
  server.use(
    api.query('Summary', () =>
      ok({ summary: { totalBalance: 0, monthIncome: 0, monthExpense: 0 } }),
    ),
  );
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items: [], totalCount: 0 } }),
    ),
  );
  server.use(api.query('Categories', () => ok({ categories: [] })));
}
```

- [ ] **Step 2: Run them and watch them fail**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/dashboard/DashboardPage.test.tsx"
```

Expected: FAIL on all four new tests — the two regions do not exist, and the
refetch counts do not move because `DashboardPage` renders no panels yet. The
six tests from Task 5 still pass.

Record what the fourth test's failure actually says: it is the RED for the
`['Summary']` invalidation and belongs in `slice-5-outcome.md`.

- [ ] **Step 3: Compose the screen and mount the route**

In `apps/frontend/src/features/dashboard/DashboardPage.tsx`, add the imports:

```tsx
import { TransactionDialog } from '@/features/transactions/TransactionDialog';
import { CategoriesPanel } from './CategoriesPanel';
import { RecentTransactionsPanel } from './RecentTransactionsPanel';
```

add the dialog state beside the period:

```tsx
  const [dialogOpen, setDialogOpen] = useState(false);
```

and insert, between the stat-card block and `</PageShell>`:

```tsx
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Each panel owns its query and its own states, so a failure in one
            does not blank the other or the cards above. */}
        <RecentTransactionsPanel onCreate={() => setDialogOpen(true)} />
        <CategoriesPanel />
      </div>

      {/* Mounted only while open, as on the transactions page: a permanently
          mounted dialog reopens holding the previous values. */}
      {dialogOpen && (
        <TransactionDialog
          open
          onClose={() => setDialogOpen(false)}
          transaction={null}
        />
      )}
```

In `apps/frontend/src/routes.tsx`: delete the `Placeholder` component and the
now-unused `PageShell` import, add
`import { DashboardPage } from '@/features/dashboard/DashboardPage';`, and
replace the placeholder in `RootRoute`:

```tsx
  return (
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  );
```

- [ ] **Step 4: Run the whole frontend suite**

```bash
rtk proxy "npm test -w @financy/frontend"
```

Expected: PASS. Confirm `routes.test.tsx` is green — its two dashboard tests are
the ones the strict MSW change was for — and that the new refetch test passes for
the right reason (it counted calls going up, not a mock that never fired).

- [ ] **Step 5: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add apps/frontend/src/features/dashboard apps/frontend/src/routes.tsx apps/frontend/src/routes.test.tsx
git commit -m "feat(frontend): serve the dashboard at the root route"
```

---

### Task 9: Re-base the seed onto relative dates

**Files:**
- Create: `apps/backend/prisma/seed-dates.ts`
- Create: `apps/backend/tests/unit/seed-dates.test.ts`
- Modify: `apps/backend/prisma/seed.ts`

**Interfaces:**
- Produces: `export function monthsBack(monthsAgo: number, day: number, now?: Date): Date`
  — local midnight on `day` of the month `monthsAgo` months before `now`.

**Why.** `prisma/seed.ts` has fixed dates in July and August 2026. The stat cards
read the current month, so from September 2026 onward a freshly seeded database
shows a dashboard of zeros — the screen looks broken while being correct.
Twelve months of data also gives slice 4's period select something to select in
every one of its thirteen options, which the fixed dates never did.

**[design correction 3]** The design says "the fixed RNG seed stays, so
descriptions, amounts, types and category assignments remain reproducible."
There is no RNG in `seed.ts` — the twenty-seven rows are literals. The intent
holds exactly as written otherwise: every row keeps its description, amount, type
and category, and only its date moves.

**[design correction 4]** Two descriptions name their month — "Salário de julho"
and "Salário de agosto". Relative dates make both wrong. Both become "Salário".

**Why the arithmetic is extracted.** `new Date(year, monthIndex - monthsAgo, day)`
rolling correctly into the previous year is exactly the kind of thing that breaks
silently in December, and `seed.ts` runs `main()` on import so it cannot be
imported by a test.

**Day-of-month safety.** Every `day` in the table is between 3 and 28, so no row
lands in a month too short for it, and no row is close enough to a month boundary
for the seed's local midnight to fall outside the UTC window `summary` uses.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/unit/seed-dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { monthsBack } from '../../prisma/seed-dates.js';

describe('monthsBack', () => {
  it('returns local midnight on the requested day of the current month', () => {
    const date = monthsBack(0, 5, new Date(2026, 7, 20, 14, 30));

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(5);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it('walks back within the same year', () => {
    const date = monthsBack(3, 12, new Date(2026, 7, 20));

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(12);
  });

  it('rolls into the previous year', () => {
    // The case that breaks silently: eleven months back from February is March
    // of the year before, not month -9 of the same one.
    const date = monthsBack(11, 3, new Date(2026, 1, 20));

    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(3);
  });

  it('reaches eleven distinct months back from January without repeating one', () => {
    const now = new Date(2027, 0, 15);
    const months = Array.from({ length: 12 }, (_, index) =>
      monthsBack(index, 10, now),
    ).map((date) => `${date.getFullYear()}-${date.getMonth()}`);

    expect(new Set(months).size).toBe(12);
    expect(months.at(-1)).toBe('2026-1');
  });

  it('keeps a day 28 inside February', () => {
    const date = monthsBack(0, 28, new Date(2027, 1, 15));

    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(28);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
rtk proxy "npm test -w @financy/backend -- tests/unit/seed-dates.test.ts"
```

Expected: FAIL — `Cannot find module '.../prisma/seed-dates.js'`.

- [ ] **Step 3: Write the helper and re-base the table**

Create `apps/backend/prisma/seed-dates.ts`:

```ts
/**
 * Local midnight on `day` of the month `monthsAgo` months before `now`, matching
 * what the app's date field submits.
 *
 * Relative rather than fixed: the dashboard's stat cards read the current month,
 * so a seed with fixed dates shows a dashboard of zeros from the month after
 * those dates onward — a screen that looks broken while being correct.
 *
 * `new Date(year, monthIndex, day)` normalises a negative month index into the
 * previous year on its own, so December needs no special case. `now` is a
 * parameter so the tests are not written against the wall clock.
 */
export function monthsBack(
  monthsAgo: number,
  day: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
}
```

Modify `apps/backend/prisma/seed.ts`:

Replace the `TRANSACTIONS` comment and table. Every row keeps its description,
amount, type and category; `day: 'YYYY-MM-DD'` becomes `monthsAgo` + `day`. The
two salary descriptions lose their month name.

```ts
/**
 * Fixed rows with dates relative to the run: descriptions, amounts, types and
 * category assignments are literals, so two runs a week apart produce the same
 * data — but the dates are computed from the run time, so the dashboard's
 * current-month figures are never zero and slice 4's period select has
 * something to select in every one of its twelve month options.
 *
 * `monthsAgo: 0` is the current month. Every `day` is between 3 and 28: no
 * month is too short for any of them, and none sits close enough to a boundary
 * for local midnight to fall outside the UTC window `summary` builds.
 *
 * Amounts are integer cents throughout — 150_000 is R$ 1.500,00.
 */
const TRANSACTIONS = [
  // The current month: a salary, the fixed bills, and enough rows for the
  // dashboard's five-row recent panel to be full.
  { monthsAgo: 0, day: 5, description: 'Salário', amount: 780_000, type: 'INCOME', category: 'Salário' },
  { monthsAgo: 0, day: 5, description: 'Aluguel', amount: 210_000, type: 'EXPENSE', category: 'Moradia' },
  { monthsAgo: 0, day: 6, description: 'Conta de água', amount: 9_120, type: 'EXPENSE', category: 'Moradia' },
  { monthsAgo: 0, day: 8, description: 'Compras da semana', amount: 35_910, type: 'EXPENSE', category: 'Mercado' },
  { monthsAgo: 0, day: 10, description: 'Uber para o aeroporto', amount: 7_830, type: 'EXPENSE', category: 'Transporte' },
  { monthsAgo: 0, day: 17, description: 'Plano de saúde', amount: 48_700, type: 'EXPENSE', category: 'Saúde' },

  { monthsAgo: 1, day: 5, description: 'Salário', amount: 780_000, type: 'INCOME', category: 'Salário' },
  { monthsAgo: 1, day: 5, description: 'Aluguel', amount: 210_000, type: 'EXPENSE', category: 'Moradia' },
  { monthsAgo: 1, day: 6, description: 'Conta de luz', amount: 18_740, type: 'EXPENSE', category: 'Moradia' },
  { monthsAgo: 1, day: 7, description: 'Compras da semana', amount: 34_215, type: 'EXPENSE', category: 'Mercado' },
  { monthsAgo: 1, day: 18, description: 'Freelance de design', amount: 120_000, type: 'INCOME', category: null },
  { monthsAgo: 1, day: 28, description: 'Compras da semana', amount: 27_640, type: 'EXPENSE', category: 'Mercado' },

  { monthsAgo: 2, day: 9, description: 'Recarga do bilhete único', amount: 10_000, type: 'EXPENSE', category: 'Transporte' },
  { monthsAgo: 2, day: 11, description: 'Cinema', amount: 6_400, type: 'EXPENSE', category: 'Lazer' },

  { monthsAgo: 3, day: 13, description: 'Farmácia', amount: 8_930, type: 'EXPENSE', category: 'Saúde' },
  { monthsAgo: 3, day: 14, description: 'Compras da semana', amount: 29_880, type: 'EXPENSE', category: 'Mercado' },

  { monthsAgo: 4, day: 16, description: 'Curso de inglês', amount: 32_000, type: 'EXPENSE', category: 'Educação' },
  { monthsAgo: 4, day: 19, description: 'Jantar fora', amount: 11_250, type: 'EXPENSE', category: 'Lazer' },

  { monthsAgo: 5, day: 21, description: 'Compras da semana', amount: 31_470, type: 'EXPENSE', category: 'Mercado' },
  { monthsAgo: 5, day: 23, description: 'Consulta médica', amount: 25_000, type: 'EXPENSE', category: 'Saúde' },

  { monthsAgo: 6, day: 26, description: 'Internet', amount: 12_990, type: 'EXPENSE', category: 'Moradia' },
  { monthsAgo: 7, day: 3, description: 'Reembolso de passagem', amount: 8_500, type: 'INCOME', category: 'Transporte' },
  { monthsAgo: 8, day: 12, description: 'Livro de arquitetura', amount: 14_900, type: 'EXPENSE', category: 'Educação' },
  { monthsAgo: 9, day: 14, description: 'Show', amount: 22_000, type: 'EXPENSE', category: 'Lazer' },
  { monthsAgo: 10, day: 15, description: 'Compras da semana', amount: 30_050, type: 'EXPENSE', category: 'Mercado' },

  { monthsAgo: 11, day: 19, description: 'Presente de aniversário', amount: 15_000, type: 'EXPENSE', category: null },
  { monthsAgo: 11, day: 21, description: 'Venda de bicicleta usada', amount: 65_000, type: 'INCOME', category: null },
] as const;
```

Delete `atLocalMidnight` and import the helper instead:

```ts
import { monthsBack } from './seed-dates.js';
```

and in the `createMany` call:

```ts
      date: monthsBack(transaction.monthsAgo, transaction.day),
```

Update the file's header comment: "Twenty-seven transactions across two months"
becomes "Twenty-seven transactions across the current month and the eleven before
it".

Prettier will reformat the one-line row objects above; let it — the layout here
is for reading the diff, not a requirement.

- [ ] **Step 4: Run the test, then run the seed for real**

```bash
rtk proxy "npm test -w @financy/backend -- tests/unit/seed-dates.test.ts"
rtk proxy "npm run db:seed -w @financy/backend"
```

Expected: PASS, 5 tests; then
`Seeded ana@financy.dev with 7 categories and 27 transactions.`

Verify the spread lands where it should — this is the check that the table above
is right, and it is not something a unit test on `monthsBack` can make:

```bash
rtk proxy "cd apps/backend && npx tsx -e \"import { prisma } from './src/shared/prisma.js'; const rows = await prisma.transaction.findMany({ select: { date: true } }); const months = new Map(); for (const r of rows) { const k = r.date.getFullYear() + '-' + String(r.date.getMonth() + 1).padStart(2, '0'); months.set(k, (months.get(k) ?? 0) + 1); } console.log([...months].sort()); console.log('distinct months', months.size, 'rows', rows.length); await prisma.\\\$disconnect();\""
```

Expected: `distinct months 12 rows 27`, with the newest month carrying 6 rows.

`db:seed` writes to `dev.db`, which is gitignored; the test suite uses `test.db`
and is untouched.

- [ ] **Step 5: Gate and commit**

```bash
rtk proxy "npm test -w @financy/backend"
rtk proxy "npm run typecheck -w @financy/backend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add apps/backend/prisma/seed.ts apps/backend/prisma/seed-dates.ts apps/backend/tests/unit/seed-dates.test.ts
git commit -m "fix(backend): seed twelve months of transactions relative to the run date"
```

---

### Task 10: Spec corrections, handoff and outcome

**Files:**
- Modify: `docs/plans/roadmap.md`
- Modify: `docs/specs/backend.md`
- Modify: `docs/specs/frontend.md`
- Create: `docs/plans/slice-5-figma-handoff.md`
- Create: `docs/plans/slice-5-outcome.md`

The definition of done requires the specs to describe what was built, in the same
PR. There is no test for a document; the verification here is the full gate plus
a read-back of each edited passage.

- [ ] **Step 1: Correct `roadmap.md`**

The slice-5 row credits `categoryStats`, the per-category aggregates and the
DataLoaders to this slice; all three shipped in slices 2 and 3. Replace it:

```markdown
| 5 | Dashboard | `summary` (`categoryStats`, the per-category aggregates and the DataLoaders shipped in slices 2 and 3) | Dashboard stat cards and panels |
```

- [ ] **Step 2: Correct `backend.md` §5**

In the "Aggregate semantics" list (around line 422), replace the `monthIncome`
bullet and the `month` bullet with:

```markdown
- `monthIncome` and `monthExpense` cover the requested calendar month only. The
  window is built in **UTC** — `Date.UTC(year, month - 1, 1)` inclusive to
  `Date.UTC(year, month, 1)` exclusive — which is what makes "the last instant of
  the final day" exact without picking a millisecond. UTC rather than
  server-local, so the same data does not produce different figures on a
  developer's machine and a deployed one; the cost is recorded as a deviation in
  `frontend.md` section 12.
- `monthExpense` is unsigned, like `Category.totalAmount`: a positive number of
  cents spent. The client renders the sign.
- `month` is 1–12 and `year` is 1970–9999. Anything outside either range is
  `BAD_USER_INPUT` naming the failing field. Both bounds exist so a nonsense
  year is an error rather than a scan returning zeros, which reads as "no data".
```

Also move `type Summary` and the `summary` field out of the monolithic SDL
listing? **No** — that listing is the spec's description of the whole graph and
stays complete. Leave lines 281–285 and 359 as they are; they still describe what
is served.

- [ ] **Step 3: Correct `frontend.md` §5 and §12**

Replace the Dashboard section's panel list (lines 196–204) with a version that
states the per-section states and the query reuse:

```markdown
Below, two panels side by side. Each of the three sections — the stat card row
and the two panels — owns its own query, and its own loading, empty and error
states, so a failure in one does not blank the others. The stat cards' empty
state is `R$ 0,00` on all three cards rather than a separate branch: a new
user's balance genuinely is zero, and a "no data yet" card could not be told
apart from a real one.

- **Transações recentes** — the five most recent transactions, each with its
  category icon badge, description, date, category tag, and signed amount with a
  type arrow. It reuses the paginated `transactions` query at `limit: 5` rather
  than a dedicated field: that query's default ordering is already
  `date DESC, createdAt DESC`. A "Ver todas" link to `/transactions` and a
  "+ Nova transação" footer button that opens the transaction dialog, both
  present in every state.
- **Categorias** — each category with its tag, item count and total amount, plus
  a "Gerenciar" link to `/categories`. Sorted by total amount descending and
  capped at five on the client, because the panel is a summary, the full list has
  its own page, and `categories` returns the whole list anyway.
```

Add one entry to §12, after the "Category tag on the dashboard" entry:

```markdown
**The summary month window is UTC; the dashboard asks for the local month.**
The server builds `summary(month, year)`'s window with `Date.UTC`
(`backend.md` section 5), while the stat cards read the browser's local clock.
For a user at UTC-3, a transaction recorded at 21:00 on 31 August local time is
stored as 1 September 00:00 UTC and counts toward September's figures. The
alternative — `dateFrom`/`dateTo` arguments on `summary`, the most correct
option per user — contradicts the `summary(month, year)` signature both specs
and the stat cards are written against, for an application with one user in one
timezone. A server-local window was rejected outright: it makes every figure
depend on the `TZ` the process happens to run under.
```

- [ ] **Step 4: Write the Figma handoff and the outcome**

Create `docs/plans/slice-5-figma-handoff.md`, following
`slice-2-figma-handoff.md`'s format. Nothing in it gates this slice — it is built
and ready to compare. It must list, at minimum:

- The three stat cards: labels ("Saldo total", "Receitas do mês",
  "Despesas do mês"), the chosen icons (`Wallet`, `ArrowUpCircle`,
  `ArrowDownCircle`) and the icon tints (neutral, `text-success`,
  `text-danger`).
- The page subtitle "Sua visão geral do mês", which the design does not name.
- The two-panel row's layout: side by side from the `lg` breakpoint, stacked
  below it.
- The recent panel's row composition: badge, description over date, category
  tag, then amount over the type indicator.
- **The panel error state renders `PanelError` inside the panel body**, so its
  card border sits inside the panel's own — an inset error box that keeps the
  panel heading and its link on screen. Confirm the nesting reads correctly.
- The categories panel row: badge, name over item count, the name tag again, then
  the total. The tag repeating the name follows the category card's existing
  treatment, itself still unconfirmed since slice 2.
- The carried-forward `/style-guide` primitive comparison, unanswered across five
  slices. No new primitive was added by this slice, so nothing new is owed here.

Create `docs/plans/slice-5-outcome.md`, following `slice-4-outcome.md`'s format:
what shipped, where the build departed from this plan, the four
**[design correction]** items above, the spec corrections made, what is open
going into a merge, and the verification numbers from Step 5 — every one from a
run through `rtk proxy`.

- [ ] **Step 5: Run the full gate and commit**

```bash
rtk proxy "npm test -w @financy/backend"
rtk proxy "npm test -w @financy/frontend"
rtk proxy "npm run typecheck"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add -A
rtk proxy "npm run codegen:check -w @financy/backend"
rtk proxy "npm run codegen:check -w @financy/frontend"
rtk proxy "git diff package.json apps/backend/package.json apps/frontend/package.json"
git commit -m "docs: correct the specs and record the slice 5 outcome"
```

The last command must print nothing. If a pinned major moved, revert the
`package.json` change and the lockfile before committing — no task in this slice
installs anything.

---

## Definition of done, slice 5

Check every line before opening the pull request.

- [ ] `summary` filters by the calling user in the `where` clause of **both**
      `groupBy` calls, with a cross-user test (Task 2, Task 3).
- [ ] `summaryArgsSchema` validates `month` and `year` through zod before Prisma
      (Task 1).
- [ ] No migration — this slice changes nothing in `schema.prisma`.
- [ ] Loading, empty and error states exist for **all three** dashboard sections
      (Tasks 5, 6, 7).
- [ ] No destructive action is added by this slice. The transaction dialog the
      dashboard opens already confirms its own deletes elsewhere.
- [ ] Interactive elements are keyboard-reachable and labelled: each panel is a
      `<section>` named by its heading, the row lists are lists, "Ver todas" and
      "Gerenciar" are links, "+ Nova transação" is a button, and skeleton
      placeholders sit behind `role="status"` + `aria-busy` rather than being
      announced as empty rows.
- [ ] `npm test` per workspace, `typecheck`, `lint`, `format:check` and
      `codegen:check` for both workspaces, all run through `rtk proxy` and all
      green, with the numbers recorded in `slice-5-outcome.md`.
- [ ] `git diff package.json apps/*/package.json` is empty.
- [ ] The specs describe what was built (Task 10).

## Out of scope

Carried forward, not chased:

- The deferred minors from `slice-3-outcome.md` and `slice-4-outcome.md` in files
  this slice does not open. The slice-4 rule holds: an item is in scope only if
  this slice already opens its file. **The transaction dialog's missing `isError`
  on its categories query stays open** — this slice renders that dialog but does
  not modify it.
- **`codegen:check` being unstaged-only.** A roadmap-level tooling change, open
  since slice 3. Worked around here by staging first, as slice 4 did.
- **The `/style-guide` primitive comparison**, unanswered across five slices. It
  has never gated anything, and this slice adds no primitive.
- **No CI.** Every claim about a green suite in this slice comes from a local run.

## Self-review against the design

| Design section | Covered by |
|---|---|
| §1 — the slice is one backend query plus the screen | Task order; roadmap correction in Task 10 |
| §2 module, SDL | Task 3 |
| §2 UTC month window, half-open, December rollover | Task 2 (`monthWindow`, two rollover tests) |
| §2 two `groupBy`s, `userId` in both, one `$transaction`, no DataLoader | Task 2 |
| §2 `monthExpense` unsigned | Task 2, rendered signed in Task 5 |
| §2 validation, bounds, `parseInput`, zod 4 rules | Task 1 |
| §2 no migration | Stated in the definition of done |
| §2 tests: success, empty month, cross-month balance, both December boundaries, each validation failure, `UNAUTHENTICATED`, cross-user | Tasks 2 and 3 |
| §3 three files in `features/dashboard/`, `routes.tsx` swap, `summary.graphql` | Tasks 5–8, Task 4 |
| §3 three data sources, `limit: 5`, client-side sort and cap | Tasks 5, 6, 7 |
| §3 local month vs UTC window | Task 4 (`currentPeriod`), recorded in Task 10 |
| §3 query keys and invalidation, no change to either dialog | Task 4 (key test), Task 8 (refetch test) |
| §3 per-section states table | Tasks 5, 6, 7 — with the `-R$ 0,00` contradiction resolved in Task 5 |
| §3 composition from existing primitives, no new primitive | Tasks 5–7; if one turns out to be needed it lands in `components/ui/` with its own test and `/style-guide` entry |
| §3 accessibility | Tasks 6, 7; checked in the definition of done |
| §3 frontend tests | Tasks 5–8 |
| §4 seed re-base | Task 9 |
| §5 four spec corrections | Task 10 |
| §6 out of scope | "Out of scope" above |
| §7 definition of done | "Definition of done, slice 5" above |

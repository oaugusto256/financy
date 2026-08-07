# Slice 4: Search and filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in person can narrow their transactions by description, type,
category and month, from a filter bar whose entire state lives in the URL, with
the result set paginated exactly as it already is.

**Architecture:** The backend adds `TransactionFilter` to the `transactions`
query — a zod-parsed filter folded into the single `where` object that both
halves of the paginated read already share, so the page and its `totalCount`
can never describe different result sets. No migration, no new module, no new
resolver: the resolver already forwards its whole `args` object. The frontend
adds `lib/period.ts` (the twelve-month period list and its date range), a
`useTransactionFilters` hook that owns the query string, and a presentational
`TransactionFilters` bar mounted above the page's four states so a user who has
filtered into nothing can still clear the filters.

**Tech Stack:** Prisma 6 + SQLite, Apollo Server 4, zod 4, graphql-codegen,
React 19, TanStack Query 5, `date-fns` 4, Tailwind 4, Vitest + MSW.

## Global Constraints

Every task's requirements implicitly include this section.

- **Interface language is Brazilian Portuguese. Code, comments, commit messages
  and PR descriptions are English.**
- TypeScript `strict: true`. **No `any`** — lint rejects it outside `generated/`.
- Colors come from the theme in `frontend/src/index.css`. No color literal
  anywhere else.
- **Tailwind never sees a class name built at runtime.** No template string, no
  `.replace()`, no interpolation — spell the class out and compose with `cn()`.
  A constructed class compiles to nothing and the element renders unstyled,
  which no test catches.
- Icons: `lucide-react` only.
- Conventional Commits, **one commit per task**.
- **This slice adds no environment variable.** If that turns out to be false,
  the variable lands in the matching `.env.example` in the same commit and this
  line is corrected — slice 3's plan asserted the same thing and was wrong.
- **Pinned majors — do not let an install drift them.** `prisma` and
  `@prisma/client` at `^6`, `@apollo/server` at `^4`, `express` and
  `@types/express` at `^4`. **No task in this plan installs a package.** If one
  appears to need it, stop and raise it; `git diff package.json` must be empty
  in every commit here.
- **Run anything you cite as evidence through `rtk proxy "<cmd>"`.** The RTK
  hook filters output and has reported a pass for a command that failed, and a
  stale SHA for a `git log`. A claim from a filtered run is not verified. (It
  did it again while this plan was being written: an unproxied
  `git log origin/main` omitted the merge commit at the head.)
- **No CI.** Nothing runs the checks on push; every claim about a green suite
  comes from a local run.
- Module SDL is a `/* GraphQL */`-tagged template literal in `schema.ts`, never
  a `.graphql` file.
- `backend/schema.graphql` is generated, committed, and listed in
  `.prettierignore`. Never hand-edit it and never format it.
- **zod 4**: `z.int()`, `z.coerce.date()`, `z.email()`. `required_error` is
  silently ignored — pass messages positionally, through `.min`/`.max`, or as
  `{ error: '...' }`.
- Frontend codegen uses `typescript-operations` **without** the schema-wide
  `typescript` plugin, and sets `enumsAsTypes`.
- **MSW is strict** (`onUnhandledRequest: 'error'`). A test that fires an
  unmocked request fails. Every render of a signed-in screen must mock `Me`
  along with the screen's own operations — and from this slice, the filter bar
  makes `Categories` unconditional on the transactions page too.
- **The frontend test script pins `TZ=America/Sao_Paulo`** (`package.json`) and
  `vite.config.ts` pins the same in `test.env`. Every date assertion in this
  slice is written against UTC−3. Brazil has no DST, so the offset is constant.
- **`format:check` is part of the gate**, alongside `test`, `typecheck`, `lint`
  and `codegen:check`. Two slice-2 tasks were sent back for skipping it.
- Password-shaped literals belong only in `tests/helpers/credentials.ts`
  (backend) and `src/test/credentials.ts` (frontend).

**Definition of done for this slice** is `docs/plans/roadmap.md`. The lines this
slice is most likely to miss: every query filters by the calling user **in the
where clause** with a cross-user test; zod validates before Prisma; loading,
empty, error **and filtered-empty** states all exist; if the implementation
reveals the spec is wrong, the spec is corrected in the same PR.

**The test-quality rule carried from `slice-3-outcome.md`:** before writing or
accepting any test in this plan, ask **would this fail if the rule it guards
were removed?** Nine of slice 3's fourteen tasks shipped a plan-prescribed test
that would not have. Where a test's teeth are not obvious, this plan names the
mutation to make and revert.

## Decisions this plan encodes

Settled during design; recorded here so no task re-opens them.

| Decision | Ruling |
|---|---|
| Period default | **"Todos os períodos" is a thirteenth option and the default.** `frontend.md` §5 lists twelve (current month + eleven before). An unfiltered `/transactions` must keep showing the whole ledger, as it does today; defaulting to the current month would land a user with older rows on the filtered-empty state on their first visit and quietly stop the page from being a full ledger. Owner's ruling. Recorded in `frontend.md` §12 by Task 9. |
| Where the filter is applied | One `Prisma.TransactionWhereInput` built once and handed to **both** `findMany` and `count`, inside the existing `prisma.$transaction`. Filtering one half and not the other reports a count for a set the page does not come from. |
| Filtering by another user's category id | Returns an **empty page**, not `NOT_FOUND`. `userId` is in the same where clause, so no row can match regardless. A `NOT_FOUND` here would confirm the id exists, which is the thing ownership hides — and unlike create/update, nothing is being attached. |
| `dateFrom` later than `dateTo` | Returns an empty page rather than `BAD_USER_INPUT`. The period select cannot produce it (it emits both bounds from one month), so a rule here would only guard hand-written queries, and an empty result is the honest answer to "rows between two dates that contain none". |
| Date bounds | Inclusive on both ends: `gte dateFrom`, `lte dateTo`. The period select sends local start-of-month and local end-of-month (`23:59:59.999`), so a transaction on the last day of the month is inside its own month. |
| Case-insensitive search | Prisma `contains` with **no `mode`**. `mode: 'insensitive'` does not exist on this client — the SQLite generator emits no `QueryMode` (verified: `grep -c QueryMode node_modules/.prisma/client/index.d.ts` → 0). SQLite's `LIKE` is already case-insensitive for ASCII, which is what `backend.md` §4 committed to. |
| `%` and `_` in a search term | Treated as LIKE wildcards, because Prisma emits no `ESCAPE` clause and escaping them means dropping to `queryRaw`. A documented limit, added to `backend.md` §4 beside the accent limit it already records. Not worth a raw query in a personal finance app searching its own owner's descriptions. |
| Uncategorized-only filtering | **Not offered.** The design's category select is "Todas" plus the user's categories, with no "Sem categoria" entry, and `categoryId: null` in a filter would have to mean "uncategorized only" — a third meaning for a field that already means "absent" and "cleared" in the create/update inputs. Empty string and null both mean "no category filter". |
| Where the filter bar renders | **Above** the loading / empty / error / populated switch, always mounted. Inside it, the filtered-empty state would be the only way back and would not render its own way out. |
| Resetting to page 1 | `setFilter` **deletes** the `page` param rather than setting `page=1`. Page 1 is what an absent param already means, the URL stays clean, and — see the next row — it cannot fight the clamp effect. |
| The clamp/reset race `slice-3-outcome.md` warned about | Not reachable, and pinned by a test. The clamp effect fires only on `pageOutOfRange`, which requires `!!result` — data for the *current* variables. Changing a filter changes the query variables, so TanStack serves a fresh cache entry with `data === undefined`; `result` is undefined and the clamp cannot fire in the same render as the reset. Task 8 tests it by filtering while on page 3. |
| Search debounce and history | 300ms, per `frontend.md` §5. The debounced write uses `replace: true`; the three selects push normally. Typing "mercado" would otherwise leave seven history entries between the user and the back button. |
| Filter state param names | `q`, `type`, `category`, `period`, plus the existing `page`. Short because they are user-visible in a shared URL; `period` holds `yyyy-MM`, and the range is derived on the client rather than putting two ISO instants in the query string. |

## Carry-overs folded into this slice

The owner's ruling: only the items in files this slice already opens. Everything
else stays on `slice-3-outcome.md`'s list for slice 5.

| Carry-over (from `slice-3-outcome.md`) | Task |
|---|---|
| No test that the transaction schemas trim whitespace | 1 |
| A mutation's `['Transactions']` invalidation is only tested against an unfiltered list — with a filter in the key it must still match by prefix | 8 |
| The categories query's `isError` is never read anywhere (the dialog's `…` placeholder cannot tell "loading" from "deleted") — the filter bar's category select gets the error state the dialog lacks | 7 |

## File structure

**Backend — modify**

| File | Change |
|---|---|
| `backend/src/modules/transaction/validation.ts` | `transactionFilterSchema`; `filter` added to `transactionPageSchema`. |
| `backend/src/modules/transaction/service.ts` | `transactionWhere()`; `listTransactions` uses it for both queries. |
| `backend/src/modules/transaction/schema.ts` | `input TransactionFilter`, `filter` argument on `transactions`. |
| `backend/schema.graphql` | Regenerated (never hand-edited). |
| `backend/src/graphql/generated/resolvers.ts` | Regenerated. |
| `backend/tests/unit/transaction-validation.test.ts` | Filter schema cases + the trim carry-over. |
| `backend/tests/integration/transaction.test.ts` | Filter over real HTTP. |

**Backend — create**

| File | Responsibility |
|---|---|
| `backend/tests/integration/transaction-filter.test.ts` | Every filter through `listTransactions`, including ownership and the count/page agreement. |

**Frontend — create**

| File | Responsibility |
|---|---|
| `frontend/src/lib/period.ts` | The thirteen period options and `yyyy-MM` → local month range. |
| `frontend/src/lib/period.test.ts` | Its unit tests. |
| `frontend/src/features/transactions/useTransactionFilters.ts` | The query string is the state: read, write, debounce, reset, clear. |
| `frontend/src/features/transactions/useTransactionFilters.test.tsx` | Its tests, through a probe component. |
| `frontend/src/features/transactions/TransactionFilters.tsx` | The bar. Presentational: props in, `onChange` out. |
| `frontend/src/features/transactions/TransactionFilters.test.tsx` | Its tests. |

**Frontend — modify:** `src/graphql/operations/transactions.graphql` (the
`$filter` variable), `src/graphql/generated/graphql.ts` (regenerated),
`src/graphql/operations/transactions.test.ts` (the filtered key),
`src/features/transactions/TransactionsPage.tsx` (bar + filtered-empty),
`src/features/transactions/TransactionsPage.test.tsx`.

**Docs — modify:** `docs/specs/backend.md` (§4 wildcard limit, §5 filter
semantics, §7 filter validation), `docs/specs/frontend.md` (§5 the thirteenth
period option, §12 the deviation). **Create:** `docs/plans/slice-4-outcome.md`,
`docs/plans/slice-4-figma-handoff.md`.

---

## Task 1: The filter's validation schema

**Files:**
- Modify: `backend/src/modules/transaction/validation.ts`
- Test: `backend/tests/unit/transaction-validation.test.ts`

**Interfaces:**
- Consumes: nothing from this slice.
- Produces: `transactionFilterSchema`, `export type TransactionFilterArgs`, and
  `transactionPageSchema` parsing to
  `{ filter: TransactionFilterArgs; limit: number; offset: number }`. Task 2
  builds its where clause from exactly that `filter` object.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/unit/transaction-validation.test.ts`:

```ts
import {
  transactionFilterSchema,
  transactionPageSchema,
} from '../../src/modules/transaction/validation.js';

describe('transactionFilterSchema', () => {
  it('accepts every field the SDL offers', () => {
    const filter = transactionFilterSchema.parse({
      search: 'mercado',
      type: 'EXPENSE',
      categoryId: 'category-1',
      dateFrom: '2026-08-01T00:00:00.000Z',
      dateTo: '2026-08-31T23:59:59.999Z',
    });

    expect(filter.search).toBe('mercado');
    expect(filter.type).toBe('EXPENSE');
    expect(filter.categoryId).toBe('category-1');
    expect(filter.dateFrom).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    expect(filter.dateTo).toEqual(new Date('2026-08-31T23:59:59.999Z'));
  });

  it('treats an empty or blank search as no search at all', () => {
    // The bar clears its input to '' rather than removing the param mid-edit.
    // Left as an empty string this becomes `contains: ''`, which is a LIKE
    // '%%' — harmless today, but it also makes the "is anything filtered"
    // question un-answerable from the parsed object.
    expect(transactionFilterSchema.parse({ search: '' }).search).toBeUndefined();
    expect(
      transactionFilterSchema.parse({ search: '   ' }).search,
    ).toBeUndefined();
  });

  it('trims a search term', () => {
    expect(transactionFilterSchema.parse({ search: '  luz  ' }).search).toBe(
      'luz',
    );
  });

  it('rejects a search longer than 100 characters', () => {
    // backend.md section 7.
    const result = transactionFilterSchema.safeParse({
      search: 'a'.repeat(101),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'A busca deve ter no máximo 100 caracteres',
    );
  });

  it('accepts exactly 100 characters', () => {
    expect(
      transactionFilterSchema.safeParse({ search: 'a'.repeat(100) }).success,
    ).toBe(true);
  });

  it('treats an empty category as no category filter', () => {
    expect(
      transactionFilterSchema.parse({ categoryId: '' }).categoryId,
    ).toBeUndefined();
    expect(
      transactionFilterSchema.parse({ categoryId: null }).categoryId,
    ).toBeUndefined();
  });

  it('rejects a type outside the enum', () => {
    expect(transactionFilterSchema.safeParse({ type: 'TRANSFER' }).success).toBe(
      false,
    );
  });

  it('rejects a null date bound rather than reading it as the epoch', () => {
    // The same trap slice 3's review found on `date`: new Date(null) is
    // 1970-01-01, a valid Date. A null bound must mean "no bound", never
    // "since the epoch" — which would silently exclude nothing on dateFrom
    // and everything on dateTo.
    expect(transactionFilterSchema.parse({ dateFrom: null }).dateFrom).toBe(
      undefined,
    );
    expect(transactionFilterSchema.parse({ dateTo: null }).dateTo).toBe(
      undefined,
    );
  });

  it('rejects a date bound that is not date-shaped', () => {
    const result = transactionFilterSchema.safeParse({ dateFrom: 42 });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Informe uma data válida');
  });

  it('parses an absent filter to an empty object, not undefined', () => {
    // The service destructures it. `undefined` there is a crash on the first
    // unfiltered request, which is every request the app makes today.
    expect(transactionPageSchema.parse({}).filter).toEqual({});
    expect(transactionPageSchema.parse({ filter: null }).filter).toEqual({});
  });

  it('carries the filter through beside the pagination bounds', () => {
    const args = transactionPageSchema.parse({
      filter: { type: 'INCOME' },
      limit: 500,
      offset: 20,
    });

    expect(args.filter.type).toBe('INCOME');
    // The clamp still applies with a filter present.
    expect(args.limit).toBe(100);
    expect(args.offset).toBe(20);
  });
});
```

And, as the trim carry-over from `slice-3-outcome.md`, append to the existing
`describe('createTransactionSchema')` and `describe('updateTransactionSchema')`
blocks in the same file:

```ts
  it('trims the description', () => {
    // Untested through slice 3: .trim() could have been dropped from the
    // shared `description` schema and nothing would have failed.
    expect(
      createTransactionSchema.parse({
        description: '  Mercado  ',
        amount: 1000,
        type: 'EXPENSE',
        date: '2026-08-01T12:00:00.000Z',
      }).description,
    ).toBe('Mercado');
  });
```

```ts
  it('trims the description and keeps a real categoryId untouched', () => {
    const parsed = updateTransactionSchema.parse({
      description: '  Luz  ',
      categoryId: 'category-1',
    });

    expect(parsed.description).toBe('Luz');
    expect(parsed.categoryId).toBe('category-1');
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `rtk proxy "npm test -w @financy/backend -- transaction-validation"`
Expected: FAIL — `transactionFilterSchema` is not exported.

- [ ] **Step 3: Implement the schema**

In `backend/src/modules/transaction/validation.ts`, above
`transactionPageSchema`:

```ts
// A filter's absent, null and empty-string forms all mean the same thing:
// no filter on that field. That is not true of the create/update inputs,
// where an empty categoryId means "clear the category" — hence a separate
// set of field schemas rather than reusing the ones above.
const searchTerm = z
  .string({ error: 'A busca deve ser um texto' })
  .trim()
  .max(100, 'A busca deve ter no máximo 100 caracteres')
  .nullish()
  .transform((value) => value || undefined);

const filterCategoryId = z
  .string({ error: 'A categoria deve ser um texto' })
  .trim()
  .nullish()
  .transform((value) => value || undefined);

// Same shape as the `date` field above and for the same reason: bare
// z.coerce.date() reads null as 1970-01-01. Here the consequence is worse
// than a wrong stored value — a null dateTo would silently return nothing.
const dateBound = z
  .union([z.string(), z.date()], { error: 'Informe uma data válida' })
  .pipe(z.coerce.date({ error: 'Informe uma data válida' }))
  .nullish()
  .transform((value) => value ?? undefined);

export const transactionFilterSchema = z.object({
  search: searchTerm,
  type: type.nullish().transform((value) => value ?? undefined),
  categoryId: filterCategoryId,
  dateFrom: dateBound,
  dateTo: dateBound,
});
```

Then add `filter` to the existing `transactionPageSchema`, leaving the `limit`
and `offset` fields and the clamp comment exactly as they are:

```ts
export const transactionPageSchema = z
  .object({
    filter: transactionFilterSchema.nullish(),
    limit: z
      .int({ error: 'O limite deve ser um número inteiro' })
      .min(1, 'O limite deve ser pelo menos 1')
      .nullish(),
    offset: z
      .int({ error: 'O deslocamento deve ser um número inteiro' })
      .min(0, 'O deslocamento não pode ser negativo')
      .nullish(),
  })
  // Below the minimum rejects, above the maximum clamps. backend.md section 5
  // says the maximum holds "regardless of what the client sends", so a request
  // for 500 rows is answered with 100 rather than an error; a request for zero
  // rows is a mistake worth naming.
  .transform(({ filter, limit, offset }) => ({
    // An empty object, never undefined: the service destructures this.
    filter: filter ?? {},
    limit: Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    offset: offset ?? 0,
  }));
```

And beside the existing type exports:

```ts
export type TransactionFilterArgs = z.infer<typeof transactionFilterSchema>;
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `rtk proxy "npm test -w @financy/backend -- transaction-validation"`
Expected: PASS, including the nine pre-existing cases in the file.

- [ ] **Step 5: Check the teeth on the null-bound test**

Temporarily replace `dateBound` with a bare
`z.coerce.date().nullish().transform((v) => v ?? undefined)` and re-run. The
"rejects a null date bound" case must fail (it will parse to the epoch, not
`undefined`). Revert.

- [ ] **Step 6: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/backend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add backend/src/modules/transaction/validation.ts backend/tests/unit/transaction-validation.test.ts
git commit -m "feat(backend): validate the transaction filter before it reaches Prisma"
```

---

## Task 2: The filter in the where clause

**Files:**
- Modify: `backend/src/modules/transaction/service.ts`
- Create: `backend/tests/integration/transaction-filter.test.ts`

**Interfaces:**
- Consumes: `transactionPageSchema`, `TransactionFilterArgs` (Task 1).
- Produces: `listTransactions(userId, args)` honouring `args.filter`. Its
  signature does not change — `args` is already `unknown`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/integration/transaction-filter.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { listTransactions } from '../../src/modules/transaction/service.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createCategory,
  createTransaction,
  createUser,
} from '../helpers/factories.js';

beforeEach(resetDatabase);

/**
 * One user with four transactions that differ in every filterable dimension,
 * so a filter that is silently ignored returns four rows instead of one and
 * every assertion below fails.
 */
async function seedFixture() {
  const { user } = await createUser();
  const mercado = await createCategory(user.id, { name: 'Mercado' });
  const salario = await createCategory(user.id, { name: 'Salário' });

  await createTransaction(user.id, {
    description: 'Compras no mercado',
    type: 'EXPENSE',
    categoryId: mercado.id,
    amount: 15_000,
    date: new Date(Date.UTC(2026, 6, 10, 12, 0, 0)), // July
  });
  await createTransaction(user.id, {
    description: 'Salário de agosto',
    type: 'INCOME',
    categoryId: salario.id,
    amount: 500_000,
    date: new Date(Date.UTC(2026, 7, 5, 12, 0, 0)), // August
  });
  await createTransaction(user.id, {
    description: 'Conta de luz',
    type: 'EXPENSE',
    categoryId: null,
    amount: 12_000,
    date: new Date(Date.UTC(2026, 7, 20, 12, 0, 0)), // August
  });
  await createTransaction(user.id, {
    description: 'MERCADO da esquina',
    type: 'EXPENSE',
    categoryId: mercado.id,
    amount: 4_000,
    date: new Date(Date.UTC(2026, 7, 25, 12, 0, 0)), // August
  });

  return { user, mercado, salario };
}

function descriptions(page: { items: { description: string }[] }) {
  return page.items.map((item) => item.description).sort();
}

describe('listTransactions with a filter', () => {
  it('matches a description substring', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { search: 'esquina' },
    });

    expect(descriptions(page)).toEqual(['MERCADO da esquina']);
    expect(page.totalCount).toBe(1);
  });

  it('matches regardless of case', async () => {
    // SQLite's LIKE is case-insensitive for ASCII, which is the whole
    // mechanism here — there is no `mode: 'insensitive'` on this client.
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { search: 'mercado' },
    });

    expect(descriptions(page)).toEqual([
      'Compras no mercado',
      'MERCADO da esquina',
    ]);
  });

  it('filters by type', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { type: 'INCOME' },
    });

    expect(descriptions(page)).toEqual(['Salário de agosto']);
    expect(page.totalCount).toBe(1);
  });

  it('filters by category', async () => {
    const { user, mercado } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { categoryId: mercado.id },
    });

    expect(descriptions(page)).toEqual([
      'Compras no mercado',
      'MERCADO da esquina',
    ]);
  });

  it('filters by an inclusive date range', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: {
        dateFrom: new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
        dateTo: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
      },
    });

    expect(descriptions(page)).toEqual([
      'Conta de luz',
      'MERCADO da esquina',
      'Salário de agosto',
    ]);
  });

  it('includes a row sitting exactly on each bound', async () => {
    // The boundary the period select relies on: a transaction on the last day
    // of the month belongs to that month. `lt` instead of `lte` drops it, and
    // a month-end row is exactly the one a user goes looking for.
    const { user } = await createUser();
    const edge = new Date(Date.UTC(2026, 7, 31, 12, 0, 0));
    await createTransaction(user.id, { description: 'Último dia', date: edge });

    const page = await listTransactions(user.id, {
      filter: { dateFrom: edge, dateTo: edge },
    });

    expect(descriptions(page)).toEqual(['Último dia']);
  });

  it('combines every filter with AND, not OR', async () => {
    const { user, mercado } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: {
        search: 'mercado',
        type: 'EXPENSE',
        categoryId: mercado.id,
        dateFrom: new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
        dateTo: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
      },
    });

    // 'Compras no mercado' matches the search, the type and the category, and
    // is excluded only by the date. An OR anywhere in the where clause returns
    // it too.
    expect(descriptions(page)).toEqual(['MERCADO da esquina']);
    expect(page.totalCount).toBe(1);
  });

  it('counts the filtered set, not the whole one', async () => {
    // The defect this guards: applying the filter to findMany but not to
    // count. The page would hold one row while the footer read "27
    // resultados" and the pagination offered three pages of nothing.
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { type: 'INCOME' },
      limit: 10,
    });

    expect(page.items).toHaveLength(1);
    expect(page.totalCount).toBe(1);
  });

  it('paginates within the filtered set', async () => {
    const { user } = await createUser();
    for (let day = 1; day <= 5; day += 1) {
      await createTransaction(user.id, {
        description: `Mercado ${day}`,
        date: new Date(Date.UTC(2026, 7, day, 12, 0, 0)),
      });
      await createTransaction(user.id, {
        description: `Outro ${day}`,
        date: new Date(Date.UTC(2026, 7, day, 13, 0, 0)),
      });
    }

    const page = await listTransactions(user.id, {
      filter: { search: 'Mercado' },
      limit: 2,
      offset: 2,
    });

    expect(page.items).toHaveLength(2);
    expect(page.totalCount).toBe(5);
    // date DESC: Mercado 5, 4 | 3, 2 | 1.
    expect(descriptions(page)).toEqual(['Mercado 2', 'Mercado 3']);
  });

  it('never reaches another user’s rows through a filter', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    await createTransaction(owner.id, { description: 'Mercado do dono' });
    await createTransaction(other.id, { description: 'Mercado do outro' });

    const page = await listTransactions(owner.id, {
      filter: { search: 'Mercado' },
    });

    expect(descriptions(page)).toEqual(['Mercado do dono']);
    expect(page.totalCount).toBe(1);
  });

  it('returns an empty page for another user’s category rather than NOT_FOUND', async () => {
    // Deliberate: userId is in the same where clause, so nothing can match.
    // NOT_FOUND would confirm whether the id exists, which is what ownership
    // hides. Nothing is being attached here, unlike create and update.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const foreign = await createCategory(other.id, { name: 'Alheia' });
    await createTransaction(owner.id, {});
    await createTransaction(other.id, { categoryId: foreign.id });

    const page = await listTransactions(owner.id, {
      filter: { categoryId: foreign.id },
    });

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
  });

  it('returns an empty page when the range is inverted', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: {
        dateFrom: new Date(Date.UTC(2026, 7, 31, 0, 0, 0)),
        dateTo: new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
      },
    });

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
  });

  it('ignores an empty filter object', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, { filter: {} });

    expect(page.totalCount).toBe(4);
  });

  it('surfaces an invalid filter as BAD_USER_INPUT', async () => {
    const { user } = await createUser();

    await expect(
      listTransactions(user.id, { filter: { search: 'a'.repeat(101) } }),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `rtk proxy "npm test -w @financy/backend -- transaction-filter"`
Expected: FAIL — every filtered case returns the unfiltered set.

- [ ] **Step 3: Implement the where clause**

In `backend/src/modules/transaction/service.ts`, add the import and the
builder, then use it in `listTransactions`:

```ts
import type { Prisma, Transaction } from '@prisma/client';
```

```ts
/**
 * The single source of the read's where clause. `userId` is not optional and
 * is not spread — it is the first key, unconditionally, so no future field can
 * be added in a way that forgets it. backend.md section 6.
 *
 * `contains` carries no `mode`: this client is generated for SQLite, which has
 * no QueryMode, and SQLite's LIKE is already case-insensitive for ASCII
 * (backend.md section 4). Note that `%` and `_` in a search term act as LIKE
 * wildcards — Prisma emits no ESCAPE clause, and §4 records the limit.
 */
function transactionWhere(
  userId: string,
  filter: TransactionFilterArgs,
): Prisma.TransactionWhereInput {
  const { search, type, categoryId, dateFrom, dateTo } = filter;

  return {
    userId,
    ...(search && { description: { contains: search } }),
    ...(type && { type }),
    ...(categoryId && { categoryId }),
    ...((dateFrom || dateTo) && {
      date: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  };
}
```

Add `TransactionFilterArgs` to the existing `./validation.js` import, then
rewrite the body of `listTransactions` — the doc comment above it keeps its
first two paragraphs and gains the third:

```ts
/**
 * Offset pagination, not cursors: the frontend needs "page 3" and date-range
 * filtering, not infinite scroll. backend.md section 5.
 *
 * The tiebreaker on createdAt is load-bearing. Without it two transactions
 * sharing a date have no defined order, so the same row can appear on page 1
 * and page 2 of consecutive requests, or on neither.
 *
 * One `where` object, built once, handed to both queries. Two objects — even
 * two that look identical — is how a filter gets applied to the page and not
 * to the count, leaving a footer that promises rows the table cannot show.
 */
export async function listTransactions(
  userId: string,
  args: unknown,
): Promise<TransactionPage> {
  const { filter, limit, offset } = parseInput(transactionPageSchema, args);
  const where = transactionWhere(userId, filter);

  const [items, totalCount] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items, totalCount };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `rtk proxy "npm test -w @financy/backend -- transaction"`
Expected: PASS — the new file and the three existing transaction suites, whose
unfiltered calls must be unaffected.

- [ ] **Step 5: Check the teeth on the count test**

Temporarily change the `count` call to `where: { userId }` and re-run. "counts
the filtered set, not the whole one" must fail. Revert.

- [ ] **Step 6: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/backend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add backend/src/modules/transaction/service.ts backend/tests/integration/transaction-filter.test.ts
git commit -m "feat(backend): filter the transaction list in the where clause"
```

---

## Task 3: `TransactionFilter` in the schema

**Files:**
- Modify: `backend/src/modules/transaction/schema.ts`
- Modify (generated, by running codegen): `backend/schema.graphql`,
  `backend/src/graphql/generated/resolvers.ts`
- Test: `backend/tests/integration/transaction.test.ts`

**Interfaces:**
- Consumes: `listTransactions` honouring `args.filter` (Task 2).
- Produces: `transactions(filter: TransactionFilter, limit: Int = 10, offset: Int = 0)`
  in the served SDL and in the committed `schema.graphql` the frontend's codegen
  reads. Task 5 depends on this artifact being committed.

The resolver is not modified: it already forwards its whole `args` object.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/integration/transaction.test.ts`, add a second query
document beside the existing `TRANSACTIONS` constant:

```ts
const FILTERED_TRANSACTIONS = /* GraphQL */ `
  query Transactions($filter: TransactionFilter, $limit: Int, $offset: Int) {
    transactions(filter: $filter, limit: $limit, offset: $offset) {
      totalCount
      items {
        id
        description
      }
    }
  }
`;
```

and a describe block. Follow the file's existing fixture pattern (a signed
token from `signToken`, rows from the factories):

```ts
describe('transactions(filter:)', () => {
  it('narrows the page and its count together', async () => {
    const { user } = await createUser();
    const token = signToken(user.id);
    await createTransaction(user.id, { description: 'Mercado' });
    await createTransaction(user.id, { description: 'Aluguel' });

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'Merc' } },
      token,
    });

    expect(body.data?.transactions).toEqual({
      totalCount: 1,
      items: [expect.objectContaining({ description: 'Mercado' })],
    });
  });

  it('accepts a filter beside limit and offset', async () => {
    // The arguments have to coexist: an SDL that declares `filter` in place of
    // the pagination arguments, or a resolver that forwards only one of them,
    // passes every single-argument test.
    const { user } = await createUser();
    const token = signToken(user.id);
    for (let day = 1; day <= 3; day += 1) {
      await createTransaction(user.id, {
        description: `Mercado ${day}`,
        date: new Date(Date.UTC(2026, 7, day, 12, 0, 0)),
      });
    }

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'Mercado' }, limit: 1, offset: 1 },
      token,
    });

    expect(body.data?.transactions).toMatchObject({
      totalCount: 3,
      items: [expect.objectContaining({ description: 'Mercado 2' })],
    });
  });

  it('rejects a search over the limit as BAD_USER_INPUT', async () => {
    const { user } = await createUser();
    const token = signToken(user.id);

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'a'.repeat(101) } },
      token,
    });

    expect(errorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('rejects an unknown filter field at the schema level', async () => {
    // Guards the input's shape: a filter typed as a free-form scalar would
    // accept this and quietly ignore it.
    const { user } = await createUser();
    const token = signToken(user.id);

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { minimumAmount: 100 } },
      token,
    });

    expect(body.errors?.length).toBeGreaterThan(0);
  });

  it('still requires authentication with a filter present', async () => {
    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'Mercado' } },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });

  it('does not reach another user’s rows through a filter', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    await createTransaction(other.id, { description: 'Mercado alheio' });

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'Mercado' } },
      token: signToken(owner.id),
    });

    expect(body.data?.transactions).toEqual({ totalCount: 0, items: [] });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `rtk proxy "npm test -w @financy/backend -- integration/transaction.test"`
Expected: FAIL — `Unknown type "TransactionFilter"`.

- [ ] **Step 3: Add the input to the module SDL**

In `backend/src/modules/transaction/schema.ts`, add the input after
`UpdateTransactionInput` and replace the `extend type Query` block, deleting the
"No filter argument" comment slice 3 left there:

```graphql
  input TransactionFilter {
    "Case-insensitive substring of the description."
    search: String
    type: TransactionType
    categoryId: ID
    "Inclusive lower bound on the transaction's own date."
    dateFrom: DateTime
    "Inclusive upper bound."
    dateTo: DateTime
  }

  extend type Query {
    transactions(
      filter: TransactionFilter
      limit: Int = 10
      offset: Int = 0
    ): TransactionPage!
  }
```

- [ ] **Step 4: Regenerate the schema artifact and the resolver types**

```bash
rtk proxy "npm run codegen -w @financy/backend"
```

Do not hand-edit `schema.graphql` and do not run Prettier over it — it is in
`.prettierignore`, and formatting it makes `format:check` and `codegen:check`
undo each other.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `rtk proxy "npm test -w @financy/backend"`
Expected: PASS, including `tests/unit/schema-artifact.test.ts`, which compares
the committed `schema.graphql` against the served SDL and is the test that fails
if Step 4 was skipped.

- [ ] **Step 6: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/backend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
rtk proxy "npm run codegen:check -w @financy/backend"
git add backend/src/modules/transaction/schema.ts backend/schema.graphql backend/src/graphql/generated backend/tests/integration/transaction.test.ts
git commit -m "feat(backend): expose TransactionFilter on the transactions query"
```

---

## Task 4: The period list

**Files:**
- Create: `frontend/src/lib/period.ts`
- Test: `frontend/src/lib/period.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ALL_PERIODS: ''` — the "Todos os períodos" value.
  - `periodOptions(now?: Date): { value: string; label: string }[]` — thirteen
    entries, `ALL_PERIODS` first, then `yyyy-MM` values newest first.
  - `periodRange(value: string): { dateFrom: string; dateTo: string } | undefined`
    — ISO instants at local start and end of that month, `undefined` for
    `ALL_PERIODS` or an unparseable value.

  Tasks 6 and 8 call `periodRange`; Task 7 renders `periodOptions`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/period.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ALL_PERIODS, periodOptions, periodRange } from '@/lib/period';

// TZ is pinned to America/Sao_Paulo (UTC−3, no DST) by the test script and by
// vite.config.ts. Every instant below is written against that offset.
const AUGUST_2026 = new Date(2026, 7, 6, 12, 0, 0);

describe('periodOptions', () => {
  it('offers the current month, the eleven before it, and "all"', () => {
    const options = periodOptions(AUGUST_2026);

    expect(options).toHaveLength(13);
    expect(options[0]).toEqual({
      value: ALL_PERIODS,
      label: 'Todos os períodos',
    });
    expect(options[1]?.value).toBe('2026-08');
    expect(options[12]?.value).toBe('2025-09');
  });

  it('labels a month in Portuguese, capitalised', () => {
    const options = periodOptions(AUGUST_2026);

    expect(options[1]?.label).toBe('Agosto de 2026');
    expect(options[12]?.label).toBe('Setembro de 2025');
  });

  it('crosses the year boundary without repeating a month', () => {
    const values = periodOptions(new Date(2026, 0, 15, 12, 0, 0))
      .slice(1)
      .map((option) => option.value);

    expect(values[0]).toBe('2026-01');
    expect(values[1]).toBe('2025-12');
    expect(new Set(values).size).toBe(12);
  });

  it('is stable on the 31st', () => {
    // subMonths(new Date(2026, 6, 31), 1) is June 30 — a naive
    // setMonth(month - 1) would give July 1 and produce two July entries.
    const values = periodOptions(new Date(2026, 6, 31, 12, 0, 0))
      .slice(1)
      .map((option) => option.value);

    expect(values.slice(0, 3)).toEqual(['2026-07', '2026-06', '2026-05']);
  });
});

describe('periodRange', () => {
  it('spans a whole local month, both ends inclusive', () => {
    expect(periodRange('2026-08')).toEqual({
      // Local midnight on August 1 is 03:00Z; the last millisecond of
      // August 31 is 02:59:59.999Z on September 1.
      dateFrom: '2026-08-01T03:00:00.000Z',
      dateTo: '2026-09-01T02:59:59.999Z',
    });
  });

  it('handles February in a leap year', () => {
    expect(periodRange('2028-02')?.dateTo).toBe('2028-03-01T02:59:59.999Z');
  });

  it('is undefined for "all periods"', () => {
    // The absence of a range is what makes the unfiltered page the default.
    expect(periodRange(ALL_PERIODS)).toBeUndefined();
  });

  it('is undefined for a hand-typed value that is not a month', () => {
    // ?period=banana is a URL a user can type. It must not become a range of
    // NaN, which Prisma would receive as an invalid date.
    expect(periodRange('banana')).toBeUndefined();
    expect(periodRange('2026-13')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `rtk proxy "npm test -w @financy/frontend -- period"`
Expected: FAIL — cannot resolve `@/lib/period`.

- [ ] **Step 3: Implement it**

Create `frontend/src/lib/period.ts`:

```ts
import {
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** The filter bar's "no period filter" value, and its default. */
export const ALL_PERIODS = '';

/** Twelve months, as frontend.md section 5 specifies. */
const MONTH_COUNT = 12;

const VALUE_FORMAT = 'yyyy-MM';

/**
 * "agosto de 2026" from date-fns, capitalised. Portuguese month names are
 * lowercase in prose, but this is a select option, and every other option in
 * the bar starts with a capital.
 */
function monthLabel(month: Date): string {
  const label = format(month, "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The current month and the eleven before it, newest first, behind an "all"
 * option that is the default. The thirteenth option is a deviation from the
 * design, recorded in frontend.md section 12: without it, a first visit to
 * /transactions would hide every row outside the current month.
 *
 * `now` is a parameter so the tests are not written against the wall clock.
 */
export function periodOptions(
  now: Date = new Date(),
): { value: string; label: string }[] {
  const months = Array.from({ length: MONTH_COUNT }, (_, index) =>
    startOfMonth(subMonths(now, index)),
  );

  return [
    { value: ALL_PERIODS, label: 'Todos os períodos' },
    ...months.map((month) => ({
      value: format(month, VALUE_FORMAT),
      label: monthLabel(month),
    })),
  ];
}

/**
 * A `yyyy-MM` value to the inclusive instants the API's dateFrom/dateTo want.
 * Local, not UTC: a transaction recorded at 22:00 on the last day of the month
 * is in that month for the person who recorded it, and UTC boundaries would
 * push it into the next one for everyone west of Greenwich.
 *
 * Undefined for "all periods" and for anything unparseable — a hand-typed
 * ?period=banana must produce no filter, never a range of Invalid Date.
 */
export function periodRange(
  value: string,
): { dateFrom: string; dateTo: string } | undefined {
  if (!value) return undefined;

  const month = parse(value, VALUE_FORMAT, new Date());
  if (!isValid(month)) return undefined;

  return {
    dateFrom: startOfMonth(month).toISOString(),
    dateTo: endOfMonth(month).toISOString(),
  };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `rtk proxy "npm test -w @financy/frontend -- period"`
Expected: PASS.

- [ ] **Step 5: Check the teeth on the inclusive-end test**

Temporarily change `endOfMonth(month)` to `startOfMonth(month)` and re-run.
"spans a whole local month" and "handles February in a leap year" must both
fail. Revert.

- [ ] **Step 6: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add frontend/src/lib/period.ts frontend/src/lib/period.test.ts
git commit -m "feat(frontend): add the period list and its month range"
```

---

## Task 5: The filter variable on the operation

**Files:**
- Modify: `frontend/src/graphql/operations/transactions.graphql`
- Modify (generated): `frontend/src/graphql/generated/graphql.ts`
- Test: `frontend/src/graphql/operations/transactions.test.ts`

**Interfaces:**
- Consumes: the committed `backend/schema.graphql` from Task 3.
- Produces: `useTransactionsQuery({ filter, limit, offset })` and the generated
  `TransactionFilter` input type, imported by Tasks 6 and 8 as
  `import type { TransactionFilter } from '@/graphql/generated/graphql'`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/graphql/operations/transactions.test.ts`:

```ts
  it('still starts with the bare literal when a filter is present', () => {
    // Both dialogs invalidate the bare ['Transactions'] and TanStack matches
    // by prefix. A filtered page whose key did not start with that literal
    // would keep showing a row the user just deleted.
    expect(
      useTransactionsQuery.getKey({
        filter: { search: 'mercado' },
        limit: 10,
        offset: 0,
      })[0],
    ).toBe('Transactions');
  });

  it('separates one filter from another', () => {
    // Two filters sharing a cache entry is a stale table: switch the type
    // select and the previous type's rows are served from cache.
    expect(
      useTransactionsQuery.getKey({
        filter: { type: 'INCOME' },
        limit: 10,
        offset: 0,
      }),
    ).not.toEqual(
      useTransactionsQuery.getKey({
        filter: { type: 'EXPENSE' },
        limit: 10,
        offset: 0,
      }),
    );
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `rtk proxy "npm test -w @financy/frontend -- operations/transactions"`
Expected: FAIL — `filter` is not part of `TransactionsQueryVariables`, so the
call does not typecheck and vitest reports the transform error.

- [ ] **Step 3: Add the variable to the document**

In `frontend/src/graphql/operations/transactions.graphql`, replace the
query's signature, leaving the selection set and the leading comment as they
are:

```graphql
query Transactions($filter: TransactionFilter, $limit: Int, $offset: Int) {
  transactions(filter: $filter, limit: $limit, offset: $offset) {
```

- [ ] **Step 4: Regenerate**

```bash
rtk proxy "npm run codegen -w @financy/frontend"
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `rtk proxy "npm test -w @financy/frontend -- operations/transactions"`
Expected: PASS, all four cases.

- [ ] **Step 6: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
rtk proxy "npm run codegen:check -w @financy/frontend"
git add frontend/src/graphql/operations frontend/src/graphql/generated
git commit -m "feat(frontend): send a filter with the transactions query"
```

---

## Task 6: The query string is the filter state

**Files:**
- Create: `frontend/src/features/transactions/useTransactionFilters.ts`
- Test: `frontend/src/features/transactions/useTransactionFilters.test.tsx`

**Interfaces:**
- Consumes: `ALL_PERIODS`, `periodRange` (Task 4); `TransactionFilter` (Task 5).
- Produces:

  ```ts
  export interface FilterValues {
    search: string;
    type: string;       // '' | 'INCOME' | 'EXPENSE'
    categoryId: string; // '' means every category
    period: string;     // '' means ALL_PERIODS, else yyyy-MM
  }

  export interface TransactionFiltersState {
    values: FilterValues;          // what the bar renders
    draftSearch: string;           // the input's own, undebounced value
    setDraftSearch: (value: string) => void;
    setValue: (field: 'type' | 'categoryId' | 'period', value: string) => void;
    clear: () => void;
    isFiltered: boolean;
    filter: TransactionFilter | undefined; // what the query sends
    page: number;
  }

  export function useTransactionFilters(): TransactionFiltersState;
  export const SEARCH_DEBOUNCE_MS = 300;
  ```

  Task 7 renders `values`, `draftSearch`, `setDraftSearch` and `setValue`;
  Task 8 uses `filter`, `page`, `isFiltered` and `clear`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/transactions/useTransactionFilters.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render } from '@testing-library/react';
import { useTransactionFilters } from './useTransactionFilters';

/**
 * A probe rather than renderHook: this hook's whole job is the URL, and the
 * router is the thing under test with it. Rendering the search string is how
 * every assertion below reads it.
 */
function Probe() {
  const filters = useTransactionFilters();
  const location = useLocation();

  return (
    <div>
      <p data-testid="search">{location.search}</p>
      <p data-testid="filter">{JSON.stringify(filters.filter ?? null)}</p>
      <p data-testid="page">{filters.page}</p>
      <p data-testid="isFiltered">{String(filters.isFiltered)}</p>
      <input
        aria-label="busca"
        value={filters.draftSearch}
        onChange={(event) => filters.setDraftSearch(event.target.value)}
      />
      <button onClick={() => filters.setValue('type', 'INCOME')}>tipo</button>
      <button onClick={() => filters.setValue('period', '2026-08')}>
        período
      </button>
      <button onClick={filters.clear}>limpar</button>
    </div>
  );
}

function renderProbe(route = '/transactions') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Probe />
    </MemoryRouter>,
  );
}

describe('useTransactionFilters', () => {
  it('sends no filter at all when nothing is set', () => {
    // The default has to be a plain undefined, not an object of empty
    // strings: an empty object still changes the query key and would split
    // the cache from every other unfiltered caller.
    renderProbe();

    expect(screen.getByTestId('filter')).toHaveTextContent('null');
    expect(screen.getByTestId('isFiltered')).toHaveTextContent('false');
    expect(screen.getByTestId('page')).toHaveTextContent('1');
  });

  it('reads every filter out of the URL', () => {
    renderProbe(
      '/transactions?q=mercado&type=EXPENSE&category=cat-1&period=2026-08&page=3',
    );

    expect(JSON.parse(screen.getByTestId('filter').textContent ?? '')).toEqual({
      search: 'mercado',
      type: 'EXPENSE',
      categoryId: 'cat-1',
      dateFrom: '2026-08-01T03:00:00.000Z',
      dateTo: '2026-09-01T02:59:59.999Z',
    });
    expect(screen.getByTestId('page')).toHaveTextContent('3');
    expect(screen.getByTestId('isFiltered')).toHaveTextContent('true');
  });

  it('writes a select straight to the URL', async () => {
    renderProbe();

    await userEvent.click(screen.getByRole('button', { name: 'tipo' }));

    expect(screen.getByTestId('search')).toHaveTextContent('type=INCOME');
  });

  it('debounces the search rather than writing per keystroke', async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.type(screen.getByLabelText('busca'), 'luz');

    // The input shows it immediately; the URL has not caught up.
    expect(screen.getByLabelText('busca')).toHaveValue('luz');
    expect(screen.getByTestId('search')).not.toHaveTextContent('q=');

    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('q=luz'),
    );
  });

  it('drops the page when a filter changes', async () => {
    // frontend.md section 5: changing any filter resets to page 1. Deleting
    // the param is the reset — an absent page already means 1, and unlike
    // page=1 it cannot collide with the page clamp effect on the page
    // component, which only ever fires on loaded data.
    renderProbe('/transactions?page=3');

    await userEvent.click(screen.getByRole('button', { name: 'tipo' }));

    expect(screen.getByTestId('page')).toHaveTextContent('1');
    expect(screen.getByTestId('search')).not.toHaveTextContent('page=');
  });

  it('drops the page when the debounced search lands', async () => {
    const user = userEvent.setup();
    renderProbe('/transactions?page=3');

    await user.type(screen.getByLabelText('busca'), 'luz');

    await waitFor(() =>
      expect(screen.getByTestId('page')).toHaveTextContent('1'),
    );
  });

  it('keeps a filter when another one changes', async () => {
    renderProbe('/transactions?q=mercado');

    await userEvent.click(screen.getByRole('button', { name: 'tipo' }));

    const search = screen.getByTestId('search');
    expect(search).toHaveTextContent('q=mercado');
    expect(search).toHaveTextContent('type=INCOME');
  });

  it('clears everything at once', async () => {
    renderProbe('/transactions?q=mercado&type=EXPENSE&period=2026-08&page=2');

    await userEvent.click(screen.getByRole('button', { name: 'limpar' }));

    expect(screen.getByTestId('search')).toHaveTextContent('');
    expect(screen.getByTestId('filter')).toHaveTextContent('null');
    expect(screen.getByLabelText('busca')).toHaveValue('');
  });

  it('ignores a period that is not a month', async () => {
    // ?period=banana is typeable. It must not reach the API as a range.
    renderProbe('/transactions?period=banana');

    expect(screen.getByTestId('filter')).toHaveTextContent('null');
  });

  it('ignores a type outside the enum', () => {
    // Likewise ?type=TRANSFER — the API would answer BAD_USER_INPUT and the
    // table would show an error state for a URL, not for a real failure.
    renderProbe('/transactions?type=TRANSFER');

    expect(screen.getByTestId('filter')).toHaveTextContent('null');
  });

  it('follows the URL when the user navigates back', async () => {
    // The reason the state lives here at all. If the hook cached the values in
    // useState, going back would change the URL and leave the bar untouched.
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole('button', { name: 'tipo' }));
    expect(screen.getByTestId('search')).toHaveTextContent('type=INCOME');

    await user.click(screen.getByRole('button', { name: 'período' }));
    expect(screen.getByTestId('search')).toHaveTextContent('period=2026-08');

    history.back();

    await waitFor(() =>
      expect(screen.getByTestId('search')).not.toHaveTextContent('period='),
    );
    expect(screen.getByTestId('search')).toHaveTextContent('type=INCOME');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `rtk proxy "npm test -w @financy/frontend -- useTransactionFilters"`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/features/transactions/useTransactionFilters.ts`:

```ts
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TransactionFilter } from '@/graphql/generated/graphql';
import { ALL_PERIODS, periodRange } from '@/lib/period';

/** frontend.md section 5: typing must not fire a request per keystroke. */
export const SEARCH_DEBOUNCE_MS = 300;

const TYPES = ['INCOME', 'EXPENSE'];

export interface FilterValues {
  search: string;
  type: string;
  categoryId: string;
  period: string;
}

export interface TransactionFiltersState {
  values: FilterValues;
  draftSearch: string;
  setDraftSearch: (value: string) => void;
  setValue: (field: 'type' | 'categoryId' | 'period', value: string) => void;
  clear: () => void;
  isFiltered: boolean;
  filter: TransactionFilter | undefined;
  page: number;
}

/**
 * Short names because they are user-visible in a shared link. `period` holds
 * yyyy-MM rather than two ISO instants: the range is derivable, and a URL
 * carrying two timestamps is not one a person can read or edit.
 */
const PARAM = {
  search: 'q',
  type: 'type',
  categoryId: 'category',
  period: 'period',
} as const;

/**
 * Every filter, and the page, live in the query string — so a filtered view
 * reloads, bookmarks, shares, and survives the back button. frontend.md
 * section 5.
 *
 * Nothing here is mirrored in component state except the search input's draft,
 * which exists only to keep typing responsive between debounce ticks. Mirroring
 * the rest would make the back button change the URL and not the bar.
 */
export function useTransactionFilters(): TransactionFiltersState {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get(PARAM.search) ?? '';
  const rawType = searchParams.get(PARAM.type) ?? '';
  // A hand-typed ?type=TRANSFER would be BAD_USER_INPUT at the API and would
  // surface as the table's error state — an error about the URL, dressed as a
  // failure to load. Unknown values are simply not filters.
  const type = TYPES.includes(rawType) ? rawType : '';
  const categoryId = searchParams.get(PARAM.categoryId) ?? '';
  const period = searchParams.get(PARAM.period) ?? ALL_PERIODS;
  const range = periodRange(period);

  const requested = Number(searchParams.get('page'));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const [draftSearch, setDraftSearch] = useState(search);

  // The URL is the source of truth, so a back navigation (or a clear) has to
  // pull the input back with it. Comparing before setting keeps this from
  // fighting the debounce below: while typing, `search` still holds the old
  // value, but the effect below is what changes it, and this one only runs
  // again once it has.
  useEffect(() => {
    setDraftSearch((current) => (current === search ? current : search));
  }, [search]);

  useEffect(() => {
    if (draftSearch === search) return;

    const timer = setTimeout(() => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (draftSearch) params.set(PARAM.search, draftSearch);
          else params.delete(PARAM.search);
          // Changing any filter resets to page 1. Deleting the param is that
          // reset: an absent page already means 1.
          params.delete('page');
          return params;
        },
        // Seven keystrokes must not become seven history entries between the
        // user and the page they came from.
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draftSearch, search, setSearchParams]);

  function setValue(field: 'type' | 'categoryId' | 'period', value: string) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (value) params.set(PARAM[field], value);
      else params.delete(PARAM[field]);
      params.delete('page');
      return params;
    });
  }

  function clear() {
    setDraftSearch('');
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      for (const name of Object.values(PARAM)) params.delete(name);
      params.delete('page');
      return params;
    });
  }

  const filter: TransactionFilter | undefined =
    search || type || categoryId || range
      ? {
          ...(search && { search }),
          ...(type && { type: type as TransactionFilter['type'] }),
          ...(categoryId && { categoryId }),
          ...(range && { dateFrom: range.dateFrom, dateTo: range.dateTo }),
        }
      : // Undefined, not {}: an empty object is a different query key from no
        // filter at all, and would split the cache for no reason.
        undefined;

  return {
    values: { search, type, categoryId, period },
    draftSearch,
    setDraftSearch,
    setValue,
    clear,
    isFiltered: filter !== undefined,
    filter,
    page,
  };
}
```

The `type as TransactionFilter['type']` cast is the one narrowing in this file
and is guarded by the `TYPES.includes` check three lines above the value's only
other use. It is a union narrowing, not an `any`.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `rtk proxy "npm test -w @financy/frontend -- useTransactionFilters"`
Expected: PASS, all twelve cases.

- [ ] **Step 5: Check the teeth on the two most load-bearing tests**

1. Remove `params.delete('page')` from `setValue` and re-run: "drops the page
   when a filter changes" must fail. Restore.
2. Replace the `useEffect` that syncs `draftSearch` from `search` with nothing
   and re-run: "clears everything at once" must fail on the input's value.
   Restore.

- [ ] **Step 6: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add frontend/src/features/transactions/useTransactionFilters.ts frontend/src/features/transactions/useTransactionFilters.test.tsx
git commit -m "feat(frontend): keep the transaction filters in the query string"
```

---

## Task 7: The filter bar

**Files:**
- Create: `frontend/src/features/transactions/TransactionFilters.tsx`
- Test: `frontend/src/features/transactions/TransactionFilters.test.tsx`

**Interfaces:**
- Consumes: `FilterValues` (Task 6), `periodOptions` (Task 4), the existing
  `Input` and `Select` primitives.
- Produces:

  ```ts
  export interface TransactionFiltersProps {
    values: FilterValues;
    draftSearch: string;
    onSearchChange: (value: string) => void;
    onValueChange: (
      field: 'type' | 'categoryId' | 'period',
      value: string,
    ) => void;
    categories: { id: string; name: string }[];
    categoriesFailed?: boolean;
  }

  export function TransactionFilters(props: TransactionFiltersProps): JSX.Element;
  ```

  Presentational only — it holds no state and issues no query, so Task 8 owns
  the wiring and this file stays testable without MSW.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/transactions/TransactionFilters.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionFilters } from './TransactionFilters';

const values = { search: '', type: '', categoryId: '', period: '' };
const categories = [
  { id: 'cat-1', name: 'Mercado' },
  { id: 'cat-2', name: 'Salário' },
];

function renderBar(overrides: Partial<Parameters<typeof TransactionFilters>[0]> = {}) {
  const onSearchChange = vi.fn();
  const onValueChange = vi.fn();

  render(
    <TransactionFilters
      values={values}
      draftSearch=""
      onSearchChange={onSearchChange}
      onValueChange={onValueChange}
      categories={categories}
      {...overrides}
    />,
  );

  return { onSearchChange, onValueChange };
}

describe('TransactionFilters', () => {
  it('offers the four controls the design draws', () => {
    renderBar();

    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Período')).toBeInTheDocument();
  });

  it('names the type options as the design does', () => {
    renderBar();

    const type = screen.getByLabelText('Tipo');
    expect(
      within(type).getByRole('option', { name: 'Todos' }),
    ).toHaveValue('');
    expect(
      within(type).getByRole('option', { name: 'Entrada' }),
    ).toHaveValue('INCOME');
    expect(
      within(type).getByRole('option', { name: 'Saída' }),
    ).toHaveValue('EXPENSE');
  });

  it('lists the user’s categories behind a "Todas" option', () => {
    renderBar();

    const category = screen.getByLabelText('Categoria');
    const options = within(category).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Todas',
      'Mercado',
      'Salário',
    ]);
  });

  it('offers thirteen periods, with "all" first and selected by default', () => {
    renderBar();

    const period = screen.getByLabelText('Período');
    const options = within(period).getAllByRole('option');
    expect(options).toHaveLength(13);
    expect(options[0]).toHaveTextContent('Todos os períodos');
    expect(period).toHaveValue('');
  });

  it('reports a typed character without waiting for anything', async () => {
    const { onSearchChange } = renderBar();

    await userEvent.type(screen.getByLabelText('Buscar'), 'a');

    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('reports a chosen type, category and period by field name', async () => {
    const { onValueChange } = renderBar();

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'INCOME');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'cat-1');

    expect(onValueChange).toHaveBeenCalledWith('type', 'INCOME');
    expect(onValueChange).toHaveBeenCalledWith('categoryId', 'cat-1');
  });

  it('shows the values it was given', () => {
    renderBar({
      values: {
        search: 'mercado',
        type: 'EXPENSE',
        categoryId: 'cat-2',
        period: '',
      },
      draftSearch: 'mercado',
    });

    expect(screen.getByLabelText('Buscar')).toHaveValue('mercado');
    expect(screen.getByLabelText('Tipo')).toHaveValue('EXPENSE');
    expect(screen.getByLabelText('Categoria')).toHaveValue('cat-2');
  });

  it('holds a selected category that is not in the list yet', () => {
    // The categories query resolves after the first render, and the URL may
    // already name a category. A native select cannot hold a value with no
    // matching <option>, so it would silently fall back to "Todas" and the
    // bar would disagree with the rows on screen.
    renderBar({
      values: { ...values, categoryId: 'cat-9' },
      categories: [],
    });

    expect(screen.getByLabelText('Categoria')).toHaveValue('cat-9');
  });

  it('says so when the category list could not be loaded', () => {
    // The gap slice 3 left in the dialog: categories.isError was never read,
    // so a failed list looked identical to a slow one.
    renderBar({ categories: [], categoriesFailed: true });

    expect(screen.getByLabelText('Categoria')).toHaveAccessibleDescription(
      'Não foi possível carregar as categorias',
    );
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `rtk proxy "npm test -w @financy/frontend -- TransactionFilters"`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the bar**

Create `frontend/src/features/transactions/TransactionFilters.tsx`:

```tsx
import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { periodOptions } from '@/lib/period';
import type { FilterValues } from './useTransactionFilters';

export interface TransactionFiltersProps {
  values: FilterValues;
  /** The search input's own value, ahead of the debounced URL write. */
  draftSearch: string;
  onSearchChange: (value: string) => void;
  onValueChange: (
    field: 'type' | 'categoryId' | 'period',
    value: string,
  ) => void;
  categories: { id: string; name: string }[];
  categoriesFailed?: boolean;
}

const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'INCOME', label: 'Entrada' },
  { value: 'EXPENSE', label: 'Saída' },
];

/**
 * Presentational. It owns no state and fires no query, so its tests need
 * neither MSW nor a router — the page above it owns both.
 */
export function TransactionFilters({
  values,
  draftSearch,
  onSearchChange,
  onValueChange,
  categories,
  categoriesFailed = false,
}: TransactionFiltersProps) {
  // Recomputed only when the component remounts, not on every keystroke —
  // and, more to the point, the twelve months are computed from `new Date()`
  // once, so the list cannot shift under the user mid-session.
  const periods = useMemo(() => periodOptions(), []);

  const categoryOptions = [
    { value: '', label: 'Todas' },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  // Same problem the transaction dialog's select has: the URL can name a
  // category before the list arrives, and a native select silently drops a
  // value with no matching <option>. A placeholder slot keyed by the same
  // value lets React swap the label in place when the real list lands.
  if (
    values.categoryId &&
    !categories.some((category) => category.id === values.categoryId)
  ) {
    categoryOptions.push({ value: values.categoryId, label: '…' });
  }

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        label="Buscar"
        placeholder="Descrição"
        icon={Search}
        type="search"
        value={draftSearch}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <Select
        label="Tipo"
        options={TYPE_OPTIONS}
        value={values.type}
        onChange={(event) => onValueChange('type', event.target.value)}
      />

      <Select
        label="Categoria"
        options={categoryOptions}
        value={values.categoryId}
        onChange={(event) => onValueChange('categoryId', event.target.value)}
        helperText={
          categoriesFailed
            ? 'Não foi possível carregar as categorias'
            : undefined
        }
      />

      <Select
        label="Período"
        options={periods}
        value={values.period}
        onChange={(event) => onValueChange('period', event.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `rtk proxy "npm test -w @financy/frontend -- TransactionFilters"`
Expected: PASS, all nine cases.

- [ ] **Step 5: Check the teeth on the placeholder test**

Delete the `categoryOptions.push({ value: values.categoryId, label: '…' })`
block and re-run: "holds a selected category that is not in the list yet" must
fail with the select reading `''`. Restore.

- [ ] **Step 6: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add frontend/src/features/transactions/TransactionFilters.tsx frontend/src/features/transactions/TransactionFilters.test.tsx
git commit -m "feat(frontend): add the transactions filter bar"
```

---

## Task 8: The filtered transactions page

**Files:**
- Modify: `frontend/src/features/transactions/TransactionsPage.tsx`
- Test: `frontend/src/features/transactions/TransactionsPage.test.tsx`

**Interfaces:**
- Consumes: `useTransactionFilters` (Task 6), `TransactionFilters` (Task 7),
  `useTransactionsQuery` with `filter` (Task 5), the existing
  `useCategoriesQuery`.
- Produces: the finished screen. Nothing else consumes it.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/features/transactions/TransactionsPage.test.tsx`. The
file's existing `beforeEach` already mocks `Me` and `Categories`; the
`Categories` mock now matters, because the bar queries it unconditionally.

```tsx
describe('TransactionsPage filters', () => {
  it('renders the bar above the loading state', async () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    // Above the state switch, not inside the populated branch: a user who has
    // filtered into nothing needs the controls that got them there.
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Carregando transações' }),
    ).toBeInTheDocument();
    await screen.findByText('Nenhuma transação ainda');
  });

  it('renders the bar above the error state', async () => {
    server.use(api.query('Transactions', () => graphqlError('NOT_FOUND')));
    renderWithProviders(<TransactionsPage />);

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
  });

  it('sends the filter the URL asks for', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({ transactions: { items: [aTransaction(1)], totalCount: 1 } });
      }),
    );

    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?q=mercado&type=EXPENSE&period=2026-08',
    });
    await screen.findByText('Transação 1');

    expect(variables).toHaveBeenLastCalledWith({
      limit: 10,
      offset: 0,
      filter: {
        search: 'mercado',
        type: 'EXPENSE',
        dateFrom: '2026-08-01T03:00:00.000Z',
        dateTo: '2026-09-01T02:59:59.999Z',
      },
    });
  });

  it('sends no filter when nothing is filtered', async () => {
    // The unfiltered page must keep making exactly the request it made before
    // this slice, or every cached entry is a miss and the default view of
    // /transactions quietly stops being the whole ledger.
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({ transactions: { items: [aTransaction(1)], totalCount: 1 } });
      }),
    );

    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    expect(variables).toHaveBeenLastCalledWith({ limit: 10, offset: 0 });
  });

  it('refetches when the type select changes', async () => {
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({ transactions: { items: [aTransaction(1)], totalCount: 1 } });
      }),
    );

    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'INCOME');

    await waitFor(() =>
      expect(variables).toHaveBeenLastCalledWith({
        limit: 10,
        offset: 0,
        filter: { type: 'INCOME' },
      }),
    );
  });

  it('goes back to page 1 when a filter changes, without bouncing off the clamp', async () => {
    // slice-3-outcome.md flagged this as the one place slice 4 could race the
    // out-of-range clamp effect: both want to rewrite `page`. It cannot,
    // because changing the filter changes the query key, so `result` is
    // undefined on that render and the clamp's `!!result` guard holds. The
    // offset in the request is the assertion.
    const variables = vi.fn();
    server.use(
      api.query('Transactions', ({ variables: received }) => {
        variables(received);
        return ok({
          transactions: {
            items: [aTransaction(1)],
            totalCount: 27,
          },
        });
      }),
    );

    renderWithProviders(<TransactionsPage />, { route: '/transactions?page=3' });
    await screen.findByText('Transação 1');
    expect(variables).toHaveBeenLastCalledWith({ limit: 10, offset: 20 });

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'INCOME');

    await waitFor(() =>
      expect(variables).toHaveBeenLastCalledWith({
        limit: 10,
        offset: 0,
        filter: { type: 'INCOME' },
      }),
    );
    // And it stays there — a clamp firing after the data lands would push the
    // offset back to 20.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '1' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });

  it('says nothing matched, not that there is nothing, when a filter empties the table', async () => {
    // frontend.md section 10: "A user who filters into nothing should not be
    // told they have no transactions."
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?q=nada-disso',
    });

    expect(
      await screen.findByText('Nenhuma transação encontrada'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Nenhuma transação ainda'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Limpar filtros' }),
    ).toBeInTheDocument();
  });

  it('clears every filter from the filtered-empty state', async () => {
    server.use(
      api.query('Transactions', ({ variables }) => {
        const { filter } = variables as { filter?: unknown };
        return ok({
          transactions: filter
            ? { items: [], totalCount: 0 }
            : { items: [aTransaction(1)], totalCount: 1 },
        });
      }),
    );

    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?q=nada-disso&type=EXPENSE',
    });
    await screen.findByText('Nenhuma transação encontrada');

    await userEvent.click(
      screen.getByRole('button', { name: 'Limpar filtros' }),
    );

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toHaveValue('');
    expect(screen.getByLabelText('Tipo')).toHaveValue('');
  });

  it('still shows the genuine empty state when nothing is filtered', async () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    expect(
      await screen.findByText('Nenhuma transação ainda'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar primeira transação' }),
    ).toBeInTheDocument();
  });

  it('refetches a filtered list after a delete', async () => {
    // The carry-over from slice-3-outcome.md: both dialogs invalidate the bare
    // ['Transactions'], and the key now carries a filter object. If prefix
    // matching failed, a deleted row would stay on screen — on a filtered
    // page only, which is the case nothing covered.
    let deleted = false;
    server.use(
      api.query('Transactions', () =>
        ok({
          transactions: deleted
            ? { items: [], totalCount: 0 }
            : { items: [aTransaction(1)], totalCount: 1 },
        }),
      ),
      api.mutation('DeleteTransaction', () => {
        deleted = true;
        return ok({ deleteTransaction: true });
      }),
    );

    renderWithProviders(<TransactionsPage />, {
      route: '/transactions?type=EXPENSE',
    });
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir Transação 1' }),
    );
    await screen.findByRole('heading', { name: 'Excluir transação' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(screen.queryByText('Transação 1')).not.toBeInTheDocument(),
    );
  });

  it('offers the categories it loaded in the category select', async () => {
    server.use(
      api.query('Categories', () =>
        ok({
          categories: [
            {
              id: 'cat-1',
              name: 'Mercado',
              description: null,
              icon: 'CART',
              color: 'GREEN',
              transactionCount: 0,
              totalAmount: 0,
            },
          ],
        }),
      ),
    );
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    expect(
      await screen.findByRole('option', { name: 'Mercado' }),
    ).toBeInTheDocument();
  });
});
```

If the `Categories` mock's field set does not match the committed
`categories.graphql` selection, read that file and mirror it — MSW does not
validate the shape, but the generated types do.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `rtk proxy "npm test -w @financy/frontend -- TransactionsPage"`
Expected: FAIL — no `Buscar` field on the page.

- [ ] **Step 3: Wire the page**

In `frontend/src/features/transactions/TransactionsPage.tsx`:

Replace the `useSearchParams` block and the page derivation at the top of the
component with the hook, and add the categories query:

```tsx
import { useTransactionFilters } from './useTransactionFilters';
import { TransactionFilters } from './TransactionFilters';
import {
  useCategoriesQuery,
  useTransactionsQuery,
} from '@/graphql/generated/graphql';
```

```tsx
export function TransactionsPage() {
  // Every filter, and the page, live in the query string. useTransactionFilters
  // owns the reading and the writing; nothing here mirrors them in state.
  const filters = useTransactionFilters();
  const { page } = filters;
  const [, setSearchParams] = useSearchParams();

  // The bar's category select. Already in the cache whenever the categories
  // page or the transaction dialog has run; here it is just another query.
  const categories = useCategoriesQuery();

  const [dialogTarget, setDialogTarget] =
    useState<TransactionFormTarget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteTransactionTarget | null>(null);

  const transactions = useTransactionsQuery({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    // Spread, not `filter: filters.filter`: an explicit `filter: undefined`
    // is still a key with a `filter` property, and would miss the cache entry
    // every pre-filter caller wrote.
    ...(filters.filter && { filter: filters.filter }),
  });
```

`goToPage` and the clamp effect keep `setSearchParams` and are otherwise
unchanged.

Then, inside `PageShell`, render the bar above the state switch and add the
filtered-empty branch:

```tsx
      <TransactionFilters
        values={filters.values}
        draftSearch={filters.draftSearch}
        onSearchChange={filters.setDraftSearch}
        onValueChange={filters.setValue}
        categories={categories.data?.categories ?? []}
        categoriesFailed={categories.isError}
      />

      {transactions.isPending || pageOutOfRange ? (
```

and replace the single `totalCount === 0` branch with the two cases:

```tsx
      ) : totalCount === 0 ? (
        // Two different empty states. frontend.md section 10: a user who
        // filtered into nothing must not be told they have no transactions —
        // and must be offered the way out.
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          {filters.isFiltered ? (
            <>
              <p className="font-medium text-gray-800">
                Nenhuma transação encontrada
              </p>
              <p className="text-sm text-gray-500">
                Nenhum resultado corresponde aos filtros aplicados.
              </p>
              <Button variant="secondary" onClick={filters.clear}>
                Limpar filtros
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-800">
                Nenhuma transação ainda
              </p>
              <p className="text-sm text-gray-500">
                Registre sua primeira despesa ou receita.
              </p>
              <Button onClick={openCreate}>Criar primeira transação</Button>
            </>
          )}
        </Card>
      ) : (
```

- [ ] **Step 4: Run the whole frontend suite**

Run: `rtk proxy "npm test -w @financy/frontend"`
Expected: PASS. The pre-existing `TransactionsPage` cases must pass unchanged —
in particular "asks for the right window when a page is chosen", which asserts
`{ limit: 10, offset: 20 }` with no `filter` key and is what pins the spread
above.

- [ ] **Step 5: Check the teeth on the filtered-empty test**

Change `filters.isFiltered ?` to `false ?` and re-run: "says nothing matched"
must fail. Revert.

- [ ] **Step 6: Gate and commit**

```bash
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
git add frontend/src/features/transactions/TransactionsPage.tsx frontend/src/features/transactions/TransactionsPage.test.tsx
git commit -m "feat(frontend): filter the transactions page from the URL"
```

---

## Task 9: The specs, the handoff and the outcome

**Files:**
- Modify: `docs/specs/backend.md`, `docs/specs/frontend.md`
- Create: `docs/plans/slice-4-figma-handoff.md`, `docs/plans/slice-4-outcome.md`

No code and no test. The definition of done requires the specs to describe what
was built, and slices 1–3 each shipped an outcome document that the next slice
started from.

- [ ] **Step 1: Correct `backend.md`**

- §4, beside the existing note that search relies on SQLite's `LIKE`: add that
  `%` and `_` in a search term are LIKE wildcards, because Prisma emits no
  `ESCAPE` clause, and that escaping them would mean dropping to `queryRaw`.
- §5, under the pagination paragraphs: state that every `TransactionFilter`
  field is optional, that they combine with AND, that `dateFrom`/`dateTo` are
  inclusive, and that a `categoryId` belonging to another user returns an empty
  page rather than `NOT_FOUND` (with the one-line reason: `userId` is in the
  same where clause, and `NOT_FOUND` would confirm the id exists).
- §7, in the validation list: note that in a filter, an empty string and null
  both mean "no filter on that field", unlike `categoryId` in
  `UpdateTransactionInput` where empty means "clear it".

- [ ] **Step 2: Correct `frontend.md`**

- §5, in the Transactions section: the period select offers **thirteen**
  options — "Todos os períodos", then the current month and the eleven before
  it — and the first is the default.
- §12, a new deviation entry, in the voice of the existing ones: *"The period
  select has a thirteenth option."* Say that §5 named twelve, that defaulting
  to the current month would land a user with older rows on the filtered-empty
  state on a first visit and silently stop `/transactions` from being a full
  ledger, and that the owner ruled for the "all" default.
- §12, a second entry: filter state uses the short parameter names `q`, `type`,
  `category` and `period`, the search write is `replace: true` so a debounced
  keystroke does not become a history entry, and changing a filter **deletes**
  the `page` parameter rather than setting it to 1.

- [ ] **Step 3: Write `docs/plans/slice-4-figma-handoff.md`**

Follow the format of `slice-3-figma-handoff.md`. Figma is not reachable from
the repo, so this is the owner's checklist. New this slice: the filter bar's
four controls and their labels, the bar's placement above the table, the
filtered-empty card's copy and its "Limpar filtros" button, and the period
option labels ("Agosto de 2026"). Carry forward the `/style-guide` primitive
comparison, still unanswered across slices 0–3.

- [ ] **Step 4: Write `docs/plans/slice-4-outcome.md`**

Follow `slice-3-outcome.md`'s structure: what shipped, where the build departed
from this plan and why, the spec corrections made, what is still open going
into slice 5, and the verification numbers from a local run through
`rtk proxy`. Carry forward, unchanged, the items slice 3 left that this slice
did not touch — the `['Summary']` invalidation with no consumer, the
placeholder dashboard, the seed's fixed July/August 2026 dates, `codegen:check`
being unstaged-only, and the rest of the deferred-minors list.

- [ ] **Step 5: Run the full gate**

```bash
rtk proxy "npm test -w @financy/backend"
rtk proxy "npm test -w @financy/frontend"
rtk proxy "npm run typecheck"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
rtk proxy "npm run codegen:check -w @financy/backend"
rtk proxy "npm run codegen:check -w @financy/frontend"
rtk proxy "git diff package.json backend/package.json frontend/package.json"
```

Run the two suites per workspace, not as one `npm test`: on a loaded machine a
single run fails several frontend files on vitest worker-startup timeouts,
which is resource contention and not a test failure (`slice-3-outcome.md`). The
`git diff` must be empty — no task in this slice installs anything.

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs: record slice 4's filter semantics and its deviations"
```

---

## Self-review of this plan

**Spec coverage.** `backend.md` §5's `TransactionFilter` — every field, Tasks
1–3. §7's `search` maximum of 100 — Task 1. §9's "pagination and each filter in
`TransactionFilter`, including search" — Task 2, plus Task 3 over HTTP.
`frontend.md` §5's four controls, the 300ms debounce, "changing any filter
resets to page 1", and filter state in the query string — Tasks 6–8. §10's
filtered-empty state that "offers to clear them" — Task 8. §12's deviation
record — Task 9. The roadmap's slice 4 row (`TransactionFilter` | filter bar,
URL-backed filter state) is fully covered.

**Not in this slice, deliberately:** anything in slice 5's row (`summary`,
`categoryStats` aggregates, the dashboard), and the `slice-3-outcome.md`
deferred minors in files this slice does not open — the owner's ruling on
carry-overs.

**Type consistency.** `TransactionFilterArgs` (Task 1) is what
`transactionWhere` takes (Task 2). The SDL input `TransactionFilter` (Task 3)
is what codegen turns into the frontend type of the same name (Task 5), which
`useTransactionFilters` returns (Task 6) and `TransactionsPage` spreads into the
query (Task 8). `FilterValues` (Task 6) is `TransactionFiltersProps['values']`
(Task 7). `periodOptions`/`periodRange`/`ALL_PERIODS` (Task 4) are used by
Tasks 6 and 7 under those exact names.

**One thing an implementer will hit that is not a plan error:** Task 8's
`aTransaction` fixture and `mockPage` helper already exist at the top of
`TransactionsPage.test.tsx`. Do not redefine them.

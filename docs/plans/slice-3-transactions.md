# Slice 3: Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A signed-in person can create, edit and delete their own transactions,
in reais converted to integer cents, optionally attached to one of their own
categories, and page through them ten at a time.

**Architecture:** The backend gains a `transaction` module in the same four-file
shape as `auth/` and `category/`, plus a second DataLoader so a page of ten rows
resolves its categories in one query. No migration: slice 2 created the
`Transaction` table one slice ahead of its API precisely so this slice would not
need one. The frontend gains `lib/currency.ts` and `lib/format.ts`, a segmented
control primitive, and `features/transactions/`. Filters are **not** in this
slice — `transactions` takes `limit` and `offset` only, and slice 4 adds
`TransactionFilter` and the filter bar on top.

**Tech Stack:** Prisma 6 + SQLite, Apollo Server 4, zod 4, `dataloader`,
graphql-codegen, React 19, TanStack Query 5, React Hook Form, `date-fns`,
Tailwind 4, Vitest + MSW.

## Global Constraints

Every task's requirements implicitly include this section.

- **Interface language is Brazilian Portuguese. Code, comments, commit messages
  and PR descriptions are English.**
- TypeScript `strict: true`. **No `any`** — lint rejects it outside `generated/`.
- Colors come from the theme in `apps/frontend/src/index.css`. No color literal
  anywhere else.
- **Tailwind never sees a class name built at runtime.** No template string, no
  `.replace()`, no interpolation — spell the class out and compose with `cn()`.
  A constructed class compiles to nothing and the element renders unstyled,
  which no test catches.
- Icons: `lucide-react` only.
- Conventional Commits, **one commit per task**.
- Every new environment variable lands in the matching `.env.example` in the
  same commit. (This slice adds `SEED_PASSWORD`, in `apps/backend/.env.example`,
  from Task 7's development seed.)
- **Pinned majors — do not let an install drift them.** `prisma` and
  `@prisma/client` at `^6`, `@apollo/server` at `^4`, `express` and
  `@types/express` at `^4`. Run `git diff package.json` before every commit that
  follows an `npm install`. Two tasks here install packages.
- **Run anything you cite as evidence through `rtk proxy "<cmd>"`.** The RTK
  hook filters output and has reported a pass for a command that failed, and a
  stale SHA for a `git log`. A claim from a filtered run is not verified.
- **No CI.** Nothing runs the checks on push; every claim about a green suite
  comes from a local run.
- Module SDL is a `/* GraphQL */`-tagged template literal in `schema.ts`, never
  a `.graphql` file.
- `apps/backend/schema.graphql` is generated, committed, and listed in
  `.prettierignore`. Never hand-edit it and never format it.
- **zod 4**: `z.int()`, `z.coerce.date()`, `z.email()`. `required_error` is
  silently ignored — pass messages positionally, through `.min`/`.max`, or as
  `{ error: '...' }`. All four forms used in this plan were verified against the
  installed zod 4.4.3.
- Frontend codegen uses `typescript-operations` **without** the schema-wide
  `typescript` plugin, and sets `enumsAsTypes`.
- **MSW is strict** (`onUnhandledRequest: 'error'`). A test that fires an
  unmocked request fails. Every render of a signed-in screen must mock `Me`
  along with the screen's own operations.
- **`format:check` is part of the gate**, alongside `test`, `typecheck`, `lint`
  and `codegen:check`. Two slice-2 tasks were sent back for skipping it.
- Password-shaped literals belong only in `tests/helpers/credentials.ts`
  (backend) and `src/test/credentials.ts` (frontend).

**Definition of done for this slice** is `docs/plans/roadmap.md`. The lines this
slice is most likely to miss: every query and mutation filters by the calling
user **in the where clause** with a cross-user test asserting `NOT_FOUND`; zod
validates before Prisma; loading, empty, error and populated states all exist;
destructive actions confirm first; if the implementation reveals the spec is
wrong, the spec is corrected in the same PR.

## Decisions this plan encodes

Settled during design; recorded here so no task re-opens them.

| Decision | Ruling |
|---|---|
| Where slice 3 stops | `transactions(limit, offset): TransactionPage!`, no `filter` argument. Pagination — backend and the table footer — is slice 3. `TransactionFilter` and the filter bar are slice 4. `roadmap.md`'s slice 4 row is corrected in task 15. |
| `limit` bounds | Below 1 **rejects** as `BAD_USER_INPUT`; above 100 **clamps**. `backend.md` §5 says the maximum holds "regardless of what the client sends"; §7's "between 1 and 100" does not say which bound does what, and is corrected in task 15. |
| The amount field | Cents-first mask. Keystrokes fill from the right, so the field holds a valid integer the whole time and submit sends it unchanged. No locale parsing, no `×100` at the boundary. |
| Dates | `date-fns`, as `frontend.md` §2 already committed to. It is not currently installed; task 8 adds it. |
| Narrow screens | The table scrolls horizontally inside an `overflow-x-auto` wrapper. One markup path, real `<table>` semantics at every width. Recorded in `frontend.md` §12. |
| Page number | Lives in the URL from the start, via `useSearchParams`. It costs the same as `useState` today and gives slice 4's "changing a filter resets to page 1" something that already exists. |
| Slice 2's parked defect | **Moot, not fixed.** React 18 removed the "state update on an unmounted component" warning; on React 19.2.8 that `setFormError` is a silent no-op. Task 15 deletes the parked item from the record rather than writing an abort-signal pattern the codebase has no use for. |

## Carry-overs folded into this slice

From `slice-2-outcome.md`. Each is attached to the task whose deliverable needs
it, rather than collected into a cleanup commit nobody reviews.

| Carry-over | Task |
|---|---|
| `parseInput` moves from `modules/auth/validation.ts` to `src/shared/` | 1 |
| `createCategory`/`updateCategory` map P2002 to `BAD_USER_INPUT` | 1 |
| `IconPicker`/`ColorPicker` drop the `registration` prop | 10 |
| Skeletons get `role="status"` + `aria-busy` | 11 |
| `PanelError` gets `role="alert"` and moves to `components/ui/` | 11 |
| Edit precedes delete in a card's DOM order | 11 |
| A card's name becomes an `<h3>` | 11 |
| `react` and `react-dom` are declared as dependencies | 8 |

That last one is not from slice 2 — it was found while writing this plan.
`node_modules/react` is 19.2.8, but `react` and `react-dom` appear in **no**
`package.json`, root or workspace. They are present only transitively, and any
install can drift or drop them.

## File structure

**Backend — create**

| File | Responsibility |
|---|---|
| `apps/backend/src/shared/validation.ts` | `parseInput`, moved out of the auth module. |
| `apps/backend/src/modules/transaction/validation.ts` | Type tokens, zod schemas for create/update, and the pagination schema. |
| `apps/backend/src/modules/transaction/service.ts` | Business rules; `userId` as first argument. |
| `apps/backend/src/modules/transaction/schema.ts` | Module SDL. |
| `apps/backend/src/modules/transaction/resolvers.ts` | Transport only. |
| `apps/backend/prisma/seed.ts` | Development data: one user, seven categories, thirty transactions. |
| `apps/backend/tests/unit/transaction-validation.test.ts` | Pure schema tests. |
| `apps/backend/tests/integration/transaction-service.test.ts` | Service rules including ownership. |
| `apps/backend/tests/integration/transaction-pagination.test.ts` | Ordering, windowing, `totalCount`, the clamp. |
| `apps/backend/tests/integration/transaction.test.ts` | Real GraphQL operations over HTTP. |

**Backend — modify:** `src/modules/auth/validation.ts` (re-export gone),
`src/modules/auth/service.ts` + `src/modules/category/service.ts` (import
`parseInput` from `shared/`), `src/modules/category/service.ts` (P2002),
`src/shared/dataloaders.ts` (`categoryById`), `src/schema.ts` (merge the
module), `codegen.ts` (`Transaction` mapper), `package.json` (the `prisma.seed`
entry), `tests/unit/auth-validation.test.ts` +
`tests/unit/category-validation.test.ts` (import path), `schema.graphql` +
`src/graphql/generated/resolvers.ts` (both regenerated).

**Frontend — create**

| File | Responsibility |
|---|---|
| `src/lib/currency.ts` | Cents ↔ display, in one place, as an inverse pair. |
| `src/lib/format.ts` | `dd/MM/yy` rendering and the date input's two conversions. |
| `src/components/ui/SegmentedControl.tsx` | Two-option control, selected side in danger or success. |
| `src/components/ui/PanelError.tsx` | The scoped error state, extracted out of `CategoriesPage`. |
| `src/components/ui/Skeleton.tsx` | The announced loading container both pages use. |
| `src/graphql/operations/transactions.graphql` | The four documents. |
| `src/features/transactions/TransactionsPage.tsx` | Page: header, table panel, footer, dialog wiring. |
| `src/features/transactions/TransactionsTable.tsx` | The six columns and the scroll wrapper. |
| `src/features/transactions/TransactionRow.tsx` | One row. |
| `src/features/transactions/TransactionDialog.tsx` | Create and edit in one form. |
| `src/features/transactions/DeleteTransactionDialog.tsx` | Destructive confirmation. |
| `src/features/transactions/validation.ts` | The form schema, mirroring the backend. |
| Tests beside each of the above | `*.test.ts`/`*.test.tsx`. |

**Frontend — modify:** `package.json` (`date-fns`, `react`, `react-dom`),
`vite.config.ts` (pin `TZ`), `src/components/ui/IconPicker.tsx` +
`ColorPicker.tsx` and their tests (drop `registration`),
`src/features/categories/CategoryDialog.tsx` (`Controller` instead of
`register` for the two pickers), `src/features/categories/CategoryCard.tsx`
(DOM order, `<h3>`) and its test,
`src/features/categories/CategoriesPage.tsx` (use the shared `PanelError` and
`Skeleton`) and its test, `src/pages/StyleGuide.tsx` + its test (the segmented
control, the new picker props), `src/routes.tsx` (drop the `/transactions`
placeholder), `src/routes.test.tsx`, `src/graphql/generated/graphql.ts`
(regenerated).

**Docs — modify:** `docs/specs/backend.md` (§7 the limit bounds),
`docs/specs/frontend.md` (§12 new entries), `docs/plans/roadmap.md` (the slice 3
and slice 4 rows, slice 3 checkboxes). **Create:**
`docs/plans/slice-3-figma-handoff.md`, `docs/plans/slice-3-outcome.md`.

## Branch

Already created off `origin/main` at `d21aa22`:

```bash
git rev-parse --abbrev-ref HEAD   # feat/slice-3-transactions
```

---

### Task 1: Shared `parseInput`, and the duplicate-name race

Two backend carry-overs from slice 2's review, done first because task 2 is the
third module that would otherwise import `parseInput` from `auth/`.

`parseInput` is a generic zod-to-`BAD_USER_INPUT` helper with nothing to do with
authentication. It sits in the auth module only because auth was the first
module to need it. The category module already imports it from there; leaving it
would make "reach into `modules/auth/` for a shared helper" the house pattern.

The second is a real race. `createCategory` checks the name and then writes, so
two concurrent requests with the same name both pass the check and the second
hits the `@@unique([userId, name])` constraint. Prisma raises P2002, nothing
catches it, and the caller gets `INTERNAL_SERVER_ERROR` — not the
`BAD_USER_INPUT` that `backend.md` §7 promises.

**Files:**
- Create: `apps/backend/src/shared/validation.ts`
- Modify: `apps/backend/src/modules/auth/validation.ts` (delete `parseInput`)
- Modify: `apps/backend/src/modules/auth/service.ts`, `apps/backend/src/modules/category/service.ts` (import path)
- Modify: `apps/backend/src/modules/category/service.ts` (P2002 mapping)
- Modify: `apps/backend/tests/unit/auth-validation.test.ts`, `apps/backend/tests/unit/category-validation.test.ts` (import path)
- Test: `apps/backend/tests/integration/category-service.test.ts` (one new case)

**Interfaces:**
- Produces: `parseInput<Schema extends z.ZodType>(schema: Schema, input: unknown): z.infer<Schema>`, now exported from `src/shared/validation.js`. Every later task imports it from there.

- [x] **Step 1: Write the failing test**

Append to `apps/backend/tests/integration/category-service.test.ts`, inside the
`createCategory` describe block:

```ts
  it('answers BAD_USER_INPUT when the unique constraint fires under a race', async () => {
    // assertNameAvailable checks and then writes, so two concurrent calls can
    // both pass the check. Simulating that with a real race is flaky; writing
    // the row directly between the check and the write is the same situation
    // with a deterministic ordering.
    const { user } = await createUser();
    await prisma.category.create({
      data: { userId: user.id, name: 'Mercado', icon: 'WALLET', color: 'GREEN' },
    });

    // Bypasses assertNameAvailable by calling Prisma the way the service does
    // once its check has already passed.
    const collide = prisma.category.create({
      data: { userId: user.id, name: 'Mercado', icon: 'WALLET', color: 'GREEN' },
    });

    await expect(collide).rejects.toMatchObject({ code: 'P2002' });

    // And through the service, the same collision is a named field error.
    await expect(
      createCategoryService(user.id, {
        name: 'Mercado',
        icon: 'WALLET',
        color: 'GREEN',
      }),
    ).rejects.toMatchObject({
      extensions: {
        code: 'BAD_USER_INPUT',
        fieldErrors: { name: ['Já existe uma categoria com esse nome'] },
      },
    });
  });
```

The existing file imports the service as `createCategory`; alias the import to
`createCategoryService` at the top of the file so it does not collide with the
`createCategory` factory helper, and update the other call sites in the file.

- [x] **Step 2: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/category-service.test.ts"
```

Expected: the new case fails on the alias not existing, then (once aliased) the
suite is green because `assertNameAvailable` still catches this particular
ordering. That is the point of the next step — the guard proves the mapping
exists even where the pre-check already covers the common path.

- [x] **Step 3: Create the shared module**

Create `apps/backend/src/shared/validation.ts`:

```ts
import { z } from 'zod';
import { badUserInput } from './errors.js';

/**
 * Parses at a service boundary, turning a zod failure into the BAD_USER_INPUT
 * error the frontend knows how to render, with the failing fields named.
 *
 * Lives in shared/ rather than in a module: it knows nothing about any domain,
 * and every module needs it. It started in modules/auth/ only because auth was
 * the first module written.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const { fieldErrors } = z.flattenError(result.error);
  const firstMessage = result.error.issues[0]?.message ?? 'Dados inválidos';

  throw badUserInput(firstMessage, fieldErrors as Record<string, string[]>);
}
```

- [x] **Step 4: Delete the old copy and re-point every importer**

In `apps/backend/src/modules/auth/validation.ts`, delete the `parseInput`
function and the now-unused `badUserInput` import. The file keeps only its
schemas and inferred types.

Update the import in `apps/backend/src/modules/auth/service.ts`,
`apps/backend/src/modules/category/service.ts`,
`apps/backend/tests/unit/auth-validation.test.ts` and
`apps/backend/tests/unit/category-validation.test.ts` from
`'../auth/validation.js'` / `'../../src/modules/auth/validation.js'` to
`'../../shared/validation.js'` / `'../../src/shared/validation.js'`.

Confirm nothing else imports it:

```bash
rtk proxy "grep -rn 'parseInput' apps/backend/src apps/backend/tests"
```

Expected: every hit is either `src/shared/validation.ts` itself or an import
from `shared/validation.js`.

- [x] **Step 5: Map P2002**

In `apps/backend/src/modules/category/service.ts`, add the import and the guard:

```ts
import { Prisma } from '@prisma/client';
```

```ts
/**
 * assertNameAvailable checks and then writes, so a concurrent request with the
 * same name can slip between the two and hit @@unique([userId, name]). Without
 * this the caller gets INTERNAL_SERVER_ERROR for what backend.md section 7
 * promises is a BAD_USER_INPUT on the name field.
 */
function rethrowDuplicateName(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw duplicateName();
  }

  throw error;
}
```

Wrap both writes:

```ts
  return prisma.category
    .create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
      },
    })
    .catch(rethrowDuplicateName);
```

and in `updateCategory`:

```ts
  const { count } = await prisma.category
    .updateMany({
      where: { id, userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.color !== undefined && { color: data.color }),
      },
    })
    .catch(rethrowDuplicateName);
```

- [x] **Step 6: Run the whole backend suite**

```bash
rtk proxy "npm test -w @financy/backend"
rtk proxy "npm run typecheck -w @financy/backend"
```

Expected: both exit 0, with the same test count as before plus one.

- [x] **Step 7: Commit**

```bash
git add apps/backend/src apps/backend/tests
git commit -m "refactor(backend): move parseInput to shared and map P2002 to a field error

parseInput knows nothing about authentication and every module needs it; the
transaction module would have been the third to import it out of auth/.

createCategory checks the name and then writes, so a concurrent duplicate hit
the unique constraint and surfaced as INTERNAL_SERVER_ERROR instead of the
BAD_USER_INPUT that backend.md section 7 promises."
```

---

### Task 2: Transaction input validation

zod schemas, validated before anything reaches Prisma. The type tokens live here
for the same reason the category tokens do — `backend.md` §2 records that SQLite
cannot hold an enum, so the closed set exists in the SDL, in TypeScript and
here, and only this one runs before a write.

The pagination schema lives here too rather than in `shared/`: `limit` and
`offset` are arguments of exactly one query, and the defaults (10, and a maximum
of 100) come from the transactions table in the design.

**Files:**
- Create: `apps/backend/src/modules/transaction/validation.ts`
- Create: `apps/backend/tests/unit/transaction-validation.test.ts`

**Interfaces:**
- Consumes: `parseInput` from `src/shared/validation.js` (task 1).
- Produces:
  - `TRANSACTION_TYPES: readonly ['INCOME', 'EXPENSE']`, `type TransactionTypeToken = 'INCOME' | 'EXPENSE'`
  - `DEFAULT_LIMIT: 10`, `MAX_LIMIT: 100`
  - `createTransactionSchema`, `updateTransactionSchema`, `transactionPageSchema`
  - `type CreateTransactionInput = { description: string; amount: number; type: TransactionTypeToken; date: Date; categoryId: string | null }`
  - `type UpdateTransactionInput = { description?: string; amount?: number; type?: TransactionTypeToken; date?: Date; categoryId?: string | null }`
  - `type TransactionPageArgs = { limit: number; offset: number }`

- [x] **Step 1: Write the failing test**

Create `apps/backend/tests/unit/transaction-validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseInput } from '../../src/shared/validation.js';
import {
  createTransactionSchema,
  transactionPageSchema,
  updateTransactionSchema,
} from '../../src/modules/transaction/validation.js';

const valid = {
  description: 'Mercado do mês',
  amount: 12_345,
  type: 'EXPENSE',
  date: new Date('2026-08-04T03:00:00.000Z'),
  categoryId: 'category-1',
};

describe('createTransactionSchema', () => {
  it('accepts a complete transaction', () => {
    expect(parseInput(createTransactionSchema, valid)).toEqual(valid);
  });

  it('trims the description', () => {
    const parsed = parseInput(createTransactionSchema, {
      ...valid,
      description: '  Mercado do mês  ',
    });

    expect(parsed.description).toBe('Mercado do mês');
  });

  it('rejects a description that is only whitespace', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, description: '   ' }),
    ).toThrow('A descrição é obrigatória');
  });

  it('rejects a description longer than 200 characters', () => {
    expect(() =>
      parseInput(createTransactionSchema, {
        ...valid,
        description: 'a'.repeat(201),
      }),
    ).toThrow('A descrição deve ter no máximo 200 caracteres');
  });

  it('rejects an amount that is not an integer', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, amount: 12.5 }),
    ).toThrow('O valor deve ser um número inteiro de centavos');
  });

  it('rejects a zero amount', () => {
    // The sign is not used — `type` carries the direction — so zero is the only
    // amount with no meaning. backend.md section 7.
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, amount: 0 }),
    ).toThrow('O valor não pode ser zero');
  });

  it('rejects a type outside the two tokens', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, type: 'TRANSFER' }),
    ).toThrow('Selecione um tipo válido');
  });

  it('rejects a date it cannot parse', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, date: 'ontem' }),
    ).toThrow('Informe uma data válida');
  });

  it('accepts an ISO string for the date and yields a Date', () => {
    // The resolver hands over whatever the DateTime scalar produced, and the
    // service is also called directly from tests with a string.
    const parsed = parseInput(createTransactionSchema, {
      ...valid,
      date: '2026-08-04T03:00:00.000Z',
    });

    expect(parsed.date).toBeInstanceOf(Date);
    expect(parsed.date.toISOString()).toBe('2026-08-04T03:00:00.000Z');
  });

  it('turns an omitted, empty or null categoryId into null', () => {
    const { categoryId, ...withoutCategory } = valid;
    expect(categoryId).toBe('category-1');

    expect(parseInput(createTransactionSchema, withoutCategory).categoryId)
      .toBeNull();
    expect(
      parseInput(createTransactionSchema, { ...valid, categoryId: '' })
        .categoryId,
    ).toBeNull();
    expect(
      parseInput(createTransactionSchema, { ...valid, categoryId: null })
        .categoryId,
    ).toBeNull();
  });

  it('names the failing field so the frontend can render it inline', () => {
    try {
      parseInput(createTransactionSchema, { ...valid, description: '' });
      throw new Error('should have thrown');
    } catch (error) {
      const extensions = (
        error as { extensions?: { fieldErrors?: Record<string, string[]> } }
      ).extensions;
      expect(extensions?.fieldErrors?.description).toContain(
        'A descrição é obrigatória',
      );
    }
  });
});

describe('updateTransactionSchema', () => {
  it('accepts a partial update', () => {
    expect(parseInput(updateTransactionSchema, { amount: 500 })).toEqual({
      amount: 500,
    });
  });

  it('accepts an empty object as a no-op', () => {
    expect(parseInput(updateTransactionSchema, {})).toEqual({});
  });

  it('distinguishes an absent categoryId from an explicit null', () => {
    // Absent means "leave the category alone", null means "make it
    // uncategorized". Collapsing the two would unlink a transaction on every
    // description edit.
    expect(parseInput(updateTransactionSchema, { amount: 500 }).categoryId)
      .toBeUndefined();
    expect(parseInput(updateTransactionSchema, { categoryId: null })).toEqual({
      categoryId: null,
    });
    expect(parseInput(updateTransactionSchema, { categoryId: '' })).toEqual({
      categoryId: null,
    });
  });

  it('applies the same limits as creation', () => {
    expect(() =>
      parseInput(updateTransactionSchema, { amount: 0 }),
    ).toThrow('O valor não pode ser zero');
    expect(() =>
      parseInput(updateTransactionSchema, { description: 'a'.repeat(201) }),
    ).toThrow('A descrição deve ter no máximo 200 caracteres');
  });
});

describe('transactionPageSchema', () => {
  it('defaults to ten rows from the start', () => {
    expect(parseInput(transactionPageSchema, {})).toEqual({
      limit: 10,
      offset: 0,
    });
  });

  it('passes a limit within range through untouched', () => {
    expect(parseInput(transactionPageSchema, { limit: 25, offset: 50 })).toEqual(
      { limit: 25, offset: 50 },
    );
  });

  it('clamps a limit above the maximum instead of erroring', () => {
    // backend.md section 5: the maximum holds "regardless of what the client
    // sends". A client asking for 500 rows wants as many as it can have.
    expect(parseInput(transactionPageSchema, { limit: 500 }).limit).toBe(100);
  });

  it('rejects a limit below one', () => {
    expect(() => parseInput(transactionPageSchema, { limit: 0 })).toThrow(
      'O limite deve ser pelo menos 1',
    );
  });

  it('rejects a negative offset', () => {
    expect(() => parseInput(transactionPageSchema, { offset: -1 })).toThrow(
      'O deslocamento não pode ser negativo',
    );
  });

  it('rejects a non-integer limit or offset', () => {
    expect(() => parseInput(transactionPageSchema, { limit: 1.5 })).toThrow(
      'O limite deve ser um número inteiro',
    );
    expect(() => parseInput(transactionPageSchema, { offset: 2.5 })).toThrow(
      'O deslocamento deve ser um número inteiro',
    );
  });

  it('treats null the way GraphQL sends an omitted nullable argument', () => {
    expect(parseInput(transactionPageSchema, { limit: null, offset: null }))
      .toEqual({ limit: 10, offset: 0 });
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/backend -- tests/unit/transaction-validation.test.ts"
```

Expected: FAIL — `Cannot find module '../../src/modules/transaction/validation.js'`.

- [x] **Step 3: Write the implementation**

Create `apps/backend/src/modules/transaction/validation.ts`:

```ts
import { z } from 'zod';

/**
 * The closed set from `backend.md` section 5. SQLite cannot hold an enum, so it
 * is enforced in the SDL, in TypeScript, and here — and this is the only one of
 * the three that runs before a write.
 */
export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;

export type TransactionTypeToken = (typeof TRANSACTION_TYPES)[number];

/** Matches the transactions table in the design: "1 a 10 | 27 resultados". */
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

const description = z
  .string()
  .trim()
  .min(1, 'A descrição é obrigatória')
  .max(200, 'A descrição deve ter no máximo 200 caracteres');

const amount = z
  .int({ error: 'O valor deve ser um número inteiro de centavos' })
  // The sign is not used; `type` carries the direction. Zero is the only amount
  // with no meaning.
  .refine((value) => value !== 0, 'O valor não pode ser zero');

// zod 4 takes the message as `{ error }`; `required_error` is silently ignored.
const type = z.enum(TRANSACTION_TYPES, { error: 'Selecione um tipo válido' });

// coerce, not z.date(): the resolver hands over whatever the DateTime scalar
// produced, and the service is also called directly from tests with a string.
const date = z.coerce.date({ error: 'Informe uma data válida' });

const categoryId = z
  .string()
  .trim()
  .nullish()
  // Undefined is left undefined so update can tell "absent" from "cleared";
  // create collapses it to null itself. An empty string arrives from a cleared
  // <select> and means the same as null. No `.min(1)` — it would reject the
  // empty string before this transform ever sees it.
  .transform((value) =>
    value === undefined
      ? undefined
      : value === null || value.length === 0
        ? null
        : value,
  );

export const createTransactionSchema = z
  .object({ description, amount, type, date, categoryId })
  .transform((input) => ({ ...input, categoryId: input.categoryId ?? null }));

export const updateTransactionSchema = z.object({
  description: description.optional(),
  amount: amount.optional(),
  type: type.optional(),
  date: date.optional(),
  categoryId,
});

export const transactionPageSchema = z
  .object({
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
  .transform(({ limit, offset }) => ({
    limit: Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    offset: offset ?? 0,
  }));

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionPageArgs = z.infer<typeof transactionPageSchema>;
```

- [x] **Step 4: Run it to make sure it passes**

```bash
rtk proxy "npm test -w @financy/backend -- tests/unit/transaction-validation.test.ts"
rtk proxy "npm run typecheck -w @financy/backend"
```

Expected: both exit 0.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/modules/transaction/validation.ts apps/backend/tests/unit/transaction-validation.test.ts
git commit -m "feat(backend): validate transaction input and pagination arguments

The limit rejects below 1 and clamps above 100: backend.md section 5 says the
maximum holds regardless of what the client sends, so asking for 500 rows is
answered with 100 rather than an error.

categoryId keeps absent and null apart, so editing a description cannot unlink
the transaction from its category."
```

---

### Task 3: The transaction service — create, update, delete

Business rules, with `userId` as the first argument of every function and in the
where clause of every query. Listing is task 4; this task is the three writes
and the single read they depend on.

The rule that matters most here is the fourth in `backend.md` §6: a supplied
`categoryId` must belong to the same user. Without it a person can attach their
own transaction to somebody else's category and learn that the category exists.
The answer is `NOT_FOUND`, never `FORBIDDEN` — `FORBIDDEN` confirms the id is
real, which is the thing being hidden.

**Files:**
- Create: `apps/backend/src/modules/transaction/service.ts`
- Create: `apps/backend/tests/integration/transaction-service.test.ts`

**Interfaces:**
- Consumes: `parseInput` from `src/shared/validation.js`; the schemas from task 2; `notFound` from `src/shared/errors.js`.
- Produces:
  - `getTransaction(userId: string, id: string): Promise<Transaction>`
  - `createTransaction(userId: string, input: unknown): Promise<Transaction>`
  - `updateTransaction(userId: string, id: string, input: unknown): Promise<Transaction>`
  - `deleteTransaction(userId: string, id: string): Promise<boolean>`

  where `Transaction` is the Prisma model. Task 4 adds `listTransactions` and
  the `TransactionPage` interface to the same file.

- [x] **Step 1: Write the failing test**

Create `apps/backend/tests/integration/transaction-service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from '../../src/modules/transaction/service.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createCategory,
  createTransaction as seedTransaction,
  createUser,
} from '../helpers/factories.js';

beforeEach(resetDatabase);

const DATE = new Date('2026-08-04T15:00:00.000Z');

describe('createTransaction', () => {
  it('stores a transaction owned by the caller', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);

    const created = await createTransaction(user.id, {
      description: 'Mercado do mês',
      amount: 12_345,
      type: 'EXPENSE',
      date: DATE,
      categoryId: category.id,
    });

    expect(created).toMatchObject({
      userId: user.id,
      description: 'Mercado do mês',
      amount: 12_345,
      type: 'EXPENSE',
      categoryId: category.id,
    });
    expect(created.date.toISOString()).toBe(DATE.toISOString());
  });

  it('stores an uncategorized transaction', async () => {
    const { user } = await createUser();

    const created = await createTransaction(user.id, {
      description: 'Troco',
      amount: 500,
      type: 'INCOME',
      date: DATE,
    });

    expect(created.categoryId).toBeNull();
  });

  it('validates before writing anything', async () => {
    const { user } = await createUser();

    await expect(
      createTransaction(user.id, {
        description: '   ',
        amount: 100,
        type: 'EXPENSE',
        date: DATE,
      }),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });

    expect(await prisma.transaction.count()).toBe(0);
  });

  it('refuses another user’s category with NOT_FOUND', async () => {
    // FORBIDDEN would confirm the id exists. backend.md section 6.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirCategory = await createCategory(other.id);

    await expect(
      createTransaction(owner.id, {
        description: 'Tentativa',
        amount: 100,
        type: 'EXPENSE',
        date: DATE,
        categoryId: theirCategory.id,
      }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

    expect(await prisma.transaction.count()).toBe(0);
  });

  it('refuses a category id that belongs to nobody', async () => {
    const { user } = await createUser();

    await expect(
      createTransaction(user.id, {
        description: 'Tentativa',
        amount: 100,
        type: 'EXPENSE',
        date: DATE,
        categoryId: 'does-not-exist',
      }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });
});

describe('getTransaction', () => {
  it('returns the caller’s own transaction', async () => {
    const { user } = await createUser();
    const seeded = await seedTransaction(user.id);

    expect((await getTransaction(user.id, seeded.id)).id).toBe(seeded.id);
  });

  it('answers NOT_FOUND for another user’s transaction', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await seedTransaction(other.id);

    await expect(getTransaction(owner.id, theirs.id)).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });
});

describe('updateTransaction', () => {
  it('applies only the fields it was given', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    const seeded = await seedTransaction(user.id, {
      categoryId: category.id,
      description: 'Antes',
      amount: 100,
    });

    const updated = await updateTransaction(user.id, seeded.id, {
      description: 'Depois',
    });

    expect(updated.description).toBe('Depois');
    expect(updated.amount).toBe(100);
    expect(updated.categoryId).toBe(category.id);
  });

  it('clears the category when told to, and leaves it alone when not', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    const seeded = await seedTransaction(user.id, { categoryId: category.id });

    const untouched = await updateTransaction(user.id, seeded.id, {
      amount: 999,
    });
    expect(untouched.categoryId).toBe(category.id);

    const cleared = await updateTransaction(user.id, seeded.id, {
      categoryId: null,
    });
    expect(cleared.categoryId).toBeNull();
  });

  it('answers NOT_FOUND for another user’s transaction', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await seedTransaction(other.id, { description: 'Deles' });

    await expect(
      updateTransaction(owner.id, theirs.id, { description: 'Meu agora' }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

    expect((await prisma.transaction.findUniqueOrThrow({
      where: { id: theirs.id },
    })).description).toBe('Deles');
  });

  it('refuses to move a transaction into another user’s category', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const seeded = await seedTransaction(owner.id);
    const theirCategory = await createCategory(other.id);

    await expect(
      updateTransaction(owner.id, seeded.id, {
        categoryId: theirCategory.id,
      }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });

  it('reports an id it does not own before it reports a bad category', async () => {
    // Existence first. Checking the category first would answer NOT_FOUND for
    // the category on a request whose real problem is the transaction id — the
    // same code, but naming the wrong resource.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await seedTransaction(other.id);

    await expect(
      updateTransaction(owner.id, theirs.id, { categoryId: 'nonsense' }),
    ).rejects.toMatchObject({ message: 'Transação não encontrado' });
  });
});

describe('deleteTransaction', () => {
  it('deletes the caller’s own transaction', async () => {
    const { user } = await createUser();
    const seeded = await seedTransaction(user.id);

    expect(await deleteTransaction(user.id, seeded.id)).toBe(true);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('answers NOT_FOUND for another user’s transaction and leaves it standing', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await seedTransaction(other.id);

    await expect(
      deleteTransaction(owner.id, theirs.id),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

    expect(await prisma.transaction.count()).toBe(1);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/transaction-service.test.ts"
```

Expected: FAIL — `Cannot find module '../../src/modules/transaction/service.js'`.

- [x] **Step 3: Write the implementation**

Create `apps/backend/src/modules/transaction/service.ts`:

```ts
import type { Transaction } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { notFound } from '../../shared/errors.js';
import { parseInput } from '../../shared/validation.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from './validation.js';

/**
 * A supplied categoryId has to belong to the same user, or a person could
 * attach their transaction to someone else's category and learn it exists.
 * NOT_FOUND, never FORBIDDEN — FORBIDDEN confirms the id is real, which is the
 * thing being hidden. backend.md section 6.
 */
async function assertCategoryOwned(
  userId: string,
  categoryId: string,
): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  if (!category) throw notFound('Categoria');
}

export async function getTransaction(
  userId: string,
  id: string,
): Promise<Transaction> {
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId },
  });
  if (!transaction) throw notFound('Transação');
  return transaction;
}

export async function createTransaction(
  userId: string,
  input: unknown,
): Promise<Transaction> {
  const data = parseInput(createTransactionSchema, input);
  if (data.categoryId) await assertCategoryOwned(userId, data.categoryId);

  return prisma.transaction.create({
    data: {
      userId,
      description: data.description,
      amount: data.amount,
      type: data.type,
      date: data.date,
      categoryId: data.categoryId,
    },
  });
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: unknown,
): Promise<Transaction> {
  const data = parseInput(updateTransactionSchema, input);

  // Existence first. Checking the category first would answer NOT_FOUND naming
  // the category on a request whose real problem is the transaction id.
  await getTransaction(userId, id);
  if (data.categoryId) await assertCategoryOwned(userId, data.categoryId);

  const { count } = await prisma.transaction.updateMany({
    where: { id, userId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.date !== undefined && { date: data.date }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    },
  });
  if (count === 0) throw notFound('Transação');

  return getTransaction(userId, id);
}

export async function deleteTransaction(
  userId: string,
  id: string,
): Promise<boolean> {
  // deleteMany scoped by { id, userId }: there is no window between fetching
  // the row and checking who owns it. backend.md section 6.
  const { count } = await prisma.transaction.deleteMany({
    where: { id, userId },
  });
  if (count === 0) throw notFound('Transação');

  return true;
}
```

`data.categoryId` is truthy only for a non-empty string, so `null` (clear it)
and `undefined` (leave it) both skip the ownership check correctly.

- [x] **Step 4: Run it to make sure it passes**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/transaction-service.test.ts"
rtk proxy "npm run typecheck -w @financy/backend"
```

Expected: both exit 0.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/modules/transaction/service.ts apps/backend/tests/integration/transaction-service.test.ts
git commit -m "feat(backend): add the transaction service

Every read and write filters by userId in the where clause, and a supplied
categoryId is checked against the same owner — otherwise a user could attach a
transaction to somebody else's category and learn that it exists.

Update checks the transaction's existence before the category, so an id the
caller does not own is reported as the transaction it is rather than as a
missing category."
```

---

### Task 4: Listing, ordering and pagination

`transactions` is paginated from the start because it is the one list that grows
without bound. Offset-based rather than cursor-based: the frontend needs "page
3" and, in slice 4, date-range filtering — not infinite scroll.

Ordering is `date DESC` then `createdAt DESC`. The tiebreaker is not decoration:
without it, two transactions on the same date have no defined order, so a row
can appear on both page 1 and page 2 across two requests, or on neither.

**Files:**
- Modify: `apps/backend/src/modules/transaction/service.ts`
- Create: `apps/backend/tests/integration/transaction-pagination.test.ts`

**Interfaces:**
- Consumes: `transactionPageSchema`, `MAX_LIMIT` from task 2.
- Produces:
  - `interface TransactionPage { items: Transaction[]; totalCount: number }`
  - `listTransactions(userId: string, args: unknown): Promise<TransactionPage>`

- [x] **Step 1: Write the failing test**

Create `apps/backend/tests/integration/transaction-pagination.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { listTransactions } from '../../src/modules/transaction/service.js';
import { resetDatabase } from '../helpers/db.js';
import { createTransaction, createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);

/** Creates `count` transactions, one per day, oldest first. */
async function seedDays(userId: string, count: number) {
  for (let day = 1; day <= count; day += 1) {
    await createTransaction(userId, {
      description: `Dia ${day}`,
      date: new Date(Date.UTC(2026, 6, day, 12, 0, 0)),
    });
  }
}

describe('listTransactions', () => {
  it('returns ten rows by default with the full count beside them', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 27);

    const page = await listTransactions(user.id, {});

    expect(page.items).toHaveLength(10);
    // The count is of the whole result set, not of the page — the footer reads
    // "1 a 10 | 27 resultados".
    expect(page.totalCount).toBe(27);
  });

  it('orders by date descending', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 3);

    const page = await listTransactions(user.id, {});

    expect(page.items.map((item) => item.description)).toEqual([
      'Dia 3',
      'Dia 2',
      'Dia 1',
    ]);
  });

  it('breaks a tie on date by createdAt descending, so a row cannot straddle two pages', async () => {
    const { user } = await createUser();
    const sameDay = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));

    const first = await createTransaction(user.id, {
      description: 'Primeira',
      date: sameDay,
    });
    const second = await createTransaction(user.id, {
      description: 'Segunda',
      date: sameDay,
    });
    expect(second.createdAt.getTime()).toBeGreaterThanOrEqual(
      first.createdAt.getTime(),
    );

    const pageOne = await listTransactions(user.id, { limit: 1, offset: 0 });
    const pageTwo = await listTransactions(user.id, { limit: 1, offset: 1 });

    expect(pageOne.items[0]?.description).toBe('Segunda');
    expect(pageTwo.items[0]?.description).toBe('Primeira');
  });

  it('windows with offset', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 27);

    const third = await listTransactions(user.id, { limit: 10, offset: 20 });

    expect(third.items).toHaveLength(7);
    expect(third.totalCount).toBe(27);
    expect(third.items[0]?.description).toBe('Dia 7');
  });

  it('returns an empty page past the end rather than erroring', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 3);

    const page = await listTransactions(user.id, { limit: 10, offset: 100 });

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(3);
  });

  it('clamps a limit above the maximum', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 101);

    expect((await listTransactions(user.id, { limit: 500 })).items).toHaveLength(
      100,
    );
  });

  it('never returns another user’s rows', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    await seedDays(owner.id, 2);
    await seedDays(other.id, 5);

    const page = await listTransactions(owner.id, {});

    expect(page.items).toHaveLength(2);
    expect(page.totalCount).toBe(2);
    expect(page.items.every((item) => item.userId === owner.id)).toBe(true);
  });

  it('counts only the caller’s rows even when the page is full', async () => {
    // totalCount comes from its own query. Scoping findMany but not count is a
    // way to leak how much data another user has without showing any of it.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    await seedDays(owner.id, 12);
    await seedDays(other.id, 40);

    expect((await listTransactions(owner.id, {})).totalCount).toBe(12);
  });

  it('surfaces a bad argument as BAD_USER_INPUT', async () => {
    const { user } = await createUser();

    await expect(
      listTransactions(user.id, { offset: -1 }),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/transaction-pagination.test.ts"
```

Expected: FAIL — `listTransactions` is not exported.

- [x] **Step 3: Write the implementation**

Add to `apps/backend/src/modules/transaction/service.ts`. Extend the schema
import:

```ts
import {
  createTransactionSchema,
  transactionPageSchema,
  updateTransactionSchema,
} from './validation.js';
```

and append:

```ts
export interface TransactionPage {
  items: Transaction[];
  totalCount: number;
}

/**
 * Offset pagination, not cursors: the frontend needs "page 3" and, from slice 4,
 * date-range filtering — not infinite scroll. backend.md section 5.
 *
 * The tiebreaker on createdAt is load-bearing. Without it two transactions
 * sharing a date have no defined order, so the same row can appear on page 1
 * and page 2 of consecutive requests, or on neither.
 *
 * Both queries carry `userId`. Scoping findMany but not count would hide the
 * other user's rows while still reporting how many of them there are.
 */
export async function listTransactions(
  userId: string,
  args: unknown,
): Promise<TransactionPage> {
  const { limit, offset } = parseInput(transactionPageSchema, args);

  const [items, totalCount] = await prisma.$transaction([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.transaction.count({ where: { userId } }),
  ]);

  return { items, totalCount };
}
```

- [x] **Step 4: Run it to make sure it passes**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/transaction-pagination.test.ts"
rtk proxy "npm run typecheck -w @financy/backend"
```

Expected: both exit 0.

If the tiebreaker test is flaky, the two rows were created inside the same
millisecond and `createdAt` is genuinely equal. Insert an `await new
Promise((resolve) => setTimeout(resolve, 2))` between the two
`createTransaction` calls in that test rather than weakening the assertion —
the ordering guarantee is the thing under test.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/modules/transaction/service.ts apps/backend/tests/integration/transaction-pagination.test.ts
git commit -m "feat(backend): paginate the transaction list

Ordered by date descending with createdAt as a tiebreaker: without it two rows
sharing a date have no defined order, so one can appear on two consecutive
pages or on neither.

totalCount runs its own scoped count. Scoping the page but not the count would
hide another user's rows while still reporting how many there are."
```

---

### Task 5: The category loader for `Transaction.category`

Ten rows on a page, each with a category, is eleven queries without a loader.
The same shape as `categoryTotals`, added to the same per-request `Loaders`
object, with `userId` captured in the closure so no call site can forget the
scope.

**Files:**
- Modify: `apps/backend/src/shared/dataloaders.ts`
- Test: `apps/backend/tests/integration/context.test.ts` (extend)
- Create: `apps/backend/tests/integration/category-loader.test.ts`

**Interfaces:**
- Produces: `Loaders` gains `categoryById: DataLoader<string, Category | null>`, where `Category` is the Prisma model. Task 6's `Transaction.category` resolver is its only consumer.

- [x] **Step 1: Write the failing test**

Create `apps/backend/tests/integration/category-loader.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { createLoaders } from '../../src/shared/dataloaders.js';
import { resetDatabase } from '../helpers/db.js';
import { createCategory, createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);

describe('categoryById', () => {
  it('maps each key to its own category', async () => {
    const { user } = await createUser();
    const first = await createCategory(user.id, { name: 'Casa' });
    const second = await createCategory(user.id, { name: 'Transporte' });

    const loaders = createLoaders(user.id);
    const [a, b] = await Promise.all([
      loaders.categoryById.load(first.id),
      loaders.categoryById.load(second.id),
    ]);

    expect(a?.name).toBe('Casa');
    expect(b?.name).toBe('Transporte');
  });

  it('issues one query for a batch of keys', async () => {
    const { user } = await createUser();
    const categories = await Promise.all([
      createCategory(user.id, { name: 'A' }),
      createCategory(user.id, { name: 'B' }),
      createCategory(user.id, { name: 'C' }),
    ]);

    // Spying on findMany rather than listening for query events: this client is
    // not built with log: ['query'], and the spy proves the property the loader
    // exists for — one call, three keys.
    const spy = vi.spyOn(prisma.category, 'findMany');
    const loaders = createLoaders(user.id);

    await Promise.all(
      categories.map((category) => loaders.categoryById.load(category.id)),
    );

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('yields null for another user’s category', async () => {
    // The batch query is scoped by userId, so a key outside the caller's scope
    // resolves to null rather than to somebody else's row.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await createCategory(other.id, { name: 'Deles' });

    const loaders = createLoaders(owner.id);

    expect(await loaders.categoryById.load(theirs.id)).toBeNull();
  });

  it('yields null for a key that matches nothing', async () => {
    const { user } = await createUser();
    const loaders = createLoaders(user.id);

    expect(await loaders.categoryById.load('does-not-exist')).toBeNull();
  });

  it('yields null for every key when there is no user', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    const loaders = createLoaders(null);

    expect(await loaders.categoryById.load(category.id)).toBeNull();
  });
});
```

Extend `apps/backend/tests/integration/context.test.ts` — wherever it asserts
`toBeInstanceOf(DataLoader)` for `categoryTotals`, add the same for
`categoryById`.

- [x] **Step 2: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/category-loader.test.ts"
```

Expected: FAIL — `loaders.categoryById` is undefined.

- [x] **Step 3: Write the implementation**

In `apps/backend/src/shared/dataloaders.ts`, extend the import and the
interface:

```ts
import type { Category } from '@prisma/client';
```

```ts
export interface Loaders {
  categoryTotals: DataLoader<string, CategoryTotals>;
  categoryById: DataLoader<string, Category | null>;
}
```

and add the loader inside the object `createLoaders` returns:

```ts
    /**
     * Ten rows on a transactions page, each with a category, is eleven queries
     * without this. backend.md section 5.
     *
     * Scoped by `userId` like every other read. A key outside the caller's
     * scope resolves to null rather than to somebody else's row — unreachable
     * through the API, since a transaction's categoryId always points at one of
     * its own owner's categories, but the scope costs nothing and the invariant
     * is then enforced rather than assumed.
     */
    categoryById: new DataLoader<string, Category | null>(
      async (categoryIds) => {
        if (!userId) return categoryIds.map(() => null);

        const categories = await prisma.category.findMany({
          where: { userId, id: { in: [...categoryIds] } },
        });

        const byId = new Map(
          categories.map((category) => [category.id, category]),
        );

        return categoryIds.map((id) => byId.get(id) ?? null);
      },
    ),
```

- [x] **Step 4: Run it to make sure it passes**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/category-loader.test.ts tests/integration/context.test.ts"
rtk proxy "npm run typecheck -w @financy/backend"
```

Expected: both exit 0.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/shared/dataloaders.ts apps/backend/tests/integration
git commit -m "feat(backend): batch category lookups for transaction rows

A page of ten transactions would otherwise resolve its categories one query at
a time. Scoped by userId in the batch query like every other read, so a key
outside the caller's scope resolves to null rather than to another user's row."
```

---

### Task 6: The transaction module — SDL, resolvers, and the generated artifacts

The public contract. The SDL is a `/* GraphQL */`-tagged template literal in
`schema.ts`, plucked out by codegen — never a `.graphql` file, or the build has
to copy non-TypeScript files into `dist/`.

No `TransactionFilter`. It belongs to slice 4 along with the filter bar; adding
the argument now would put an untested parameter in the public schema with
nothing calling it.

`Transaction` needs a codegen mapper for the same reason `Category` does: the
parent of the `category` field is a database row, which has a `categoryId` and
no `category`.

**Files:**
- Create: `apps/backend/src/modules/transaction/schema.ts`
- Create: `apps/backend/src/modules/transaction/resolvers.ts`
- Modify: `apps/backend/src/schema.ts`, `apps/backend/codegen.ts`
- Regenerate: `apps/backend/schema.graphql`, `apps/backend/src/graphql/generated/resolvers.ts`
- Create: `apps/backend/tests/integration/transaction.test.ts`

**Interfaces:**
- Consumes: the service from tasks 3 and 4; `requireUser` from `src/shared/auth-guard.js`; `loaders.categoryById` from task 5.
- Produces: `transactionTypeDefs`, `transactionResolvers`. The SDL below is what task 9's frontend documents are generated against.

- [x] **Step 1: Write the failing test**

Create `apps/backend/tests/integration/transaction.test.ts`:

```ts
import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { GraphQLContext } from '../../src/context.js';
import { prisma } from '../../src/shared/prisma.js';
import { signToken } from '../../src/shared/jwt.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createCategory,
  createTransaction,
  createUser,
} from '../helpers/factories.js';
import { errorCode, execute } from '../helpers/graphql.js';

let app: Express;
let apollo: ApolloServer<GraphQLContext>;

const TRANSACTIONS = /* GraphQL */ `
  query Transactions($limit: Int, $offset: Int) {
    transactions(limit: $limit, offset: $offset) {
      totalCount
      items {
        id
        description
        amount
        type
        date
        category {
          id
          name
          color
        }
      }
    }
  }
`;

const CREATE_TRANSACTION = /* GraphQL */ `
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      id
      description
      amount
      type
      date
      category {
        id
        name
      }
    }
  }
`;

const UPDATE_TRANSACTION = /* GraphQL */ `
  mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      id
      description
      amount
      category {
        id
      }
    }
  }
`;

const DELETE_TRANSACTION = /* GraphQL */ `
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

afterAll(async () => {
  await apollo.stop();
});

beforeEach(resetDatabase);

async function signedIn() {
  const { user } = await createUser();
  return { user, token: await signToken(user.id) };
}

describe('transactions', () => {
  it('returns a page of the caller’s transactions with their categories', async () => {
    const { user, token } = await signedIn();
    const category = await createCategory(user.id, { name: 'Casa' });
    await createTransaction(user.id, {
      description: 'Aluguel',
      amount: 150_000,
      type: 'EXPENSE',
      categoryId: category.id,
      date: new Date(Date.UTC(2026, 6, 10, 12, 0, 0)),
    });

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      totalCount: number;
      items: {
        description: string;
        amount: number;
        type: string;
        category: { name: string } | null;
      }[];
    };

    expect(page.totalCount).toBe(1);
    expect(page.items[0]).toMatchObject({
      description: 'Aluguel',
      amount: 150_000,
      type: 'EXPENSE',
      category: { name: 'Casa' },
    });
  });

  it('renders an uncategorized transaction with a null category', async () => {
    const { user, token } = await signedIn();
    await createTransaction(user.id, { categoryId: null });

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      items: { category: unknown }[];
    };

    expect(page.items[0]?.category).toBeNull();
  });

  it('renders a null category once the category is deleted', async () => {
    // onDelete: SetNull. The row survives with no category rather than being
    // deleted with it — history is the most valuable thing in this system.
    const { user, token } = await signedIn();
    const category = await createCategory(user.id);
    await createTransaction(user.id, { categoryId: category.id });

    await prisma.category.delete({ where: { id: category.id } });

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      totalCount: number;
      items: { category: unknown }[];
    };

    expect(page.totalCount).toBe(1);
    expect(page.items[0]?.category).toBeNull();
  });

  it('defaults to ten rows and reports the full count', async () => {
    const { user, token } = await signedIn();
    for (let day = 1; day <= 27; day += 1) {
      await createTransaction(user.id, {
        date: new Date(Date.UTC(2026, 6, day, 12, 0, 0)),
      });
    }

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      totalCount: number;
      items: unknown[];
    };

    expect(page.items).toHaveLength(10);
    expect(page.totalCount).toBe(27);
  });

  it('never shows another user’s rows', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    await createTransaction(other.id);

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      totalCount: number;
      items: unknown[];
    };

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
  });

  it('requires a token', async () => {
    const body = await execute(app, { query: TRANSACTIONS });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('createTransaction', () => {
  it('creates a transaction for the caller', async () => {
    const { user, token } = await signedIn();
    const category = await createCategory(user.id, { name: 'Mercado' });

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: 'Compras da semana',
          amount: 8_990,
          type: 'EXPENSE',
          date: '2026-08-04T15:00:00.000Z',
          categoryId: category.id,
        },
      },
    });

    expect(body.data?.createTransaction).toMatchObject({
      description: 'Compras da semana',
      amount: 8_990,
      type: 'EXPENSE',
      category: { name: 'Mercado' },
    });
  });

  it('creates an uncategorized transaction', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: 'Troco',
          amount: 500,
          type: 'INCOME',
          date: '2026-08-04T15:00:00.000Z',
        },
      },
    });

    expect(
      (body.data?.createTransaction as { category: unknown }).category,
    ).toBeNull();
  });

  it('rejects an empty description', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: '   ',
          amount: 500,
          type: 'INCOME',
          date: '2026-08-04T15:00:00.000Z',
        },
      },
    });

    expect(errorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('rejects a zero amount', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: 'Nada',
          amount: 0,
          type: 'INCOME',
          date: '2026-08-04T15:00:00.000Z',
        },
      },
    });

    expect(errorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('answers NOT_FOUND for another user’s category', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    const theirCategory = await createCategory(other.id);

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: 'Tentativa',
          amount: 100,
          type: 'EXPENSE',
          date: '2026-08-04T15:00:00.000Z',
          categoryId: theirCategory.id,
        },
      },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('requires a token', async () => {
    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      variables: {
        input: {
          description: 'Sem sessão',
          amount: 100,
          type: 'EXPENSE',
          date: '2026-08-04T15:00:00.000Z',
        },
      },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('updateTransaction', () => {
  it('updates the caller’s own transaction', async () => {
    const { user, token } = await signedIn();
    const seeded = await createTransaction(user.id, { description: 'Antes' });

    const body = await execute(app, {
      query: UPDATE_TRANSACTION,
      token,
      variables: { id: seeded.id, input: { description: 'Depois' } },
    });

    expect(body.data?.updateTransaction).toMatchObject({
      description: 'Depois',
    });
  });

  it('answers NOT_FOUND for another user’s transaction', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    const theirs = await createTransaction(other.id, { description: 'Deles' });

    const body = await execute(app, {
      query: UPDATE_TRANSACTION,
      token,
      variables: { id: theirs.id, input: { description: 'Meu agora' } },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
  });

  it('answers NOT_FOUND when moving into another user’s category', async () => {
    const { user, token } = await signedIn();
    const { user: other } = await createUser();
    const seeded = await createTransaction(user.id);
    const theirCategory = await createCategory(other.id);

    const body = await execute(app, {
      query: UPDATE_TRANSACTION,
      token,
      variables: { id: seeded.id, input: { categoryId: theirCategory.id } },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
  });

  it('requires a token', async () => {
    const { user } = await createUser();
    const seeded = await createTransaction(user.id);

    const body = await execute(app, {
      query: UPDATE_TRANSACTION,
      variables: { id: seeded.id, input: { description: 'x' } },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('deleteTransaction', () => {
  it('deletes the caller’s own transaction', async () => {
    const { user, token } = await signedIn();
    const seeded = await createTransaction(user.id);

    const body = await execute(app, {
      query: DELETE_TRANSACTION,
      token,
      variables: { id: seeded.id },
    });

    expect(body.data?.deleteTransaction).toBe(true);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('answers NOT_FOUND for another user’s transaction and leaves it standing', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    const theirs = await createTransaction(other.id);

    const body = await execute(app, {
      query: DELETE_TRANSACTION,
      token,
      variables: { id: theirs.id },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
    expect(await prisma.transaction.count()).toBe(1);
  });

  it('requires a token', async () => {
    const { user } = await createUser();
    const seeded = await createTransaction(user.id);

    const body = await execute(app, {
      query: DELETE_TRANSACTION,
      variables: { id: seeded.id },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/backend -- tests/integration/transaction.test.ts"
```

Expected: FAIL — every operation errors with `Cannot query field "transactions"
on type "Query"`.

- [x] **Step 3: Write the module SDL**

Create `apps/backend/src/modules/transaction/schema.ts`:

```ts
export const transactionTypeDefs = /* GraphQL */ `
  enum TransactionType {
    INCOME
    EXPENSE
  }

  type Transaction {
    id: ID!
    description: String!
    amount: Int!
    type: TransactionType!
    date: DateTime!
    category: Category
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TransactionPage {
    items: [Transaction!]!
    totalCount: Int!
  }

  input CreateTransactionInput {
    description: String!
    amount: Int!
    type: TransactionType!
    date: DateTime!
    categoryId: ID
  }

  input UpdateTransactionInput {
    description: String
    amount: Int
    type: TransactionType
    date: DateTime
    categoryId: ID
  }

  extend type Query {
    # No filter argument: TransactionFilter and the filter bar are slice 4.
    # Declaring it here with nothing calling it would put an untested parameter
    # in the public schema.
    transactions(limit: Int = 10, offset: Int = 0): TransactionPage!
  }

  extend type Mutation {
    createTransaction(input: CreateTransactionInput!): Transaction!
    updateTransaction(id: ID!, input: UpdateTransactionInput!): Transaction!
    deleteTransaction(id: ID!): Boolean!
  }
`;
```

`amount` is `Int`, so the schema itself caps a value at 2 147 483 647 — about
R$ 21 474 836,47. Task 8 clamps the input field to the same number so the
frontend cannot compose a value the schema will refuse.

- [x] **Step 4: Write the resolvers**

Create `apps/backend/src/modules/transaction/resolvers.ts`:

```ts
import type { Resolvers } from '../../graphql/generated/resolvers.js';
import { requireUser } from '../../shared/auth-guard.js';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from './service.js';

export const transactionResolvers: Resolvers = {
  Query: {
    transactions: (_parent, args, context) =>
      listTransactions(requireUser(context), args),
  },

  Mutation: {
    createTransaction: (_parent, { input }, context) =>
      createTransaction(requireUser(context), input),
    updateTransaction: (_parent, { id, input }, context) =>
      updateTransaction(requireUser(context), id, input),
    deleteTransaction: (_parent, { id }, context) =>
      deleteTransaction(requireUser(context), id),
  },

  Transaction: {
    // Through the loader, not a query per row: ten rows cost one lookup.
    // Guarding on categoryId keeps a null out of the loader's key list, which
    // would otherwise be a cache entry for the string "null".
    category: (transaction, _args, context) =>
      transaction.categoryId
        ? context.loaders.categoryById.load(transaction.categoryId)
        : null,
  },
};
```

- [x] **Step 5: Merge the module and add the mapper**

In `apps/backend/src/schema.ts`, add the imports, extend `typeDefs`, and merge
the resolvers:

```ts
import { transactionTypeDefs } from './modules/transaction/schema.js';
import { transactionResolvers } from './modules/transaction/resolvers.js';
```

```ts
export const typeDefs = [
  rootTypeDefs,
  authTypeDefs,
  categoryTypeDefs,
  transactionTypeDefs,
];
```

```ts
  Query: {
    health: () => 'ok',
    ...(authResolvers.Query ?? {}),
    ...(categoryResolvers.Query ?? {}),
    ...(transactionResolvers.Query ?? {}),
  },

  Mutation: {
    ...(authResolvers.Mutation ?? {}),
    ...(categoryResolvers.Mutation ?? {}),
    ...(transactionResolvers.Mutation ?? {}),
  },

  Category: categoryResolvers.Category,
  Transaction: transactionResolvers.Transaction,
```

In `apps/backend/codegen.ts`, add the mapper beside `Category`:

```ts
          // Same reason as Category: the parent of the `category` field is a
          // database row, which has a categoryId and no category.
          Transaction: '@prisma/client#Transaction as TransactionModel',
```

`TransactionPage` needs no mapper — codegen rewrites its `items` to the mapped
`Transaction` on its own.

- [x] **Step 6: Regenerate and run**

```bash
rtk proxy "npm run codegen -w @financy/backend"
rtk proxy "npm test -w @financy/backend -- tests/integration/transaction.test.ts"
rtk proxy "npm run typecheck -w @financy/backend"
```

Expected: all three exit 0. `schema.graphql` now contains `TransactionPage` and
the three mutations. Do not hand-edit or format it.

- [x] **Step 7: Run the whole backend gate**

```bash
rtk proxy "npm test -w @financy/backend"
rtk proxy "npm run typecheck -w @financy/backend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
rtk proxy "npm run codegen:check -w @financy/backend"
```

Expected: five exit 0s. `codegen:check` reporting a diff means step 6's output
was not committed — stage it rather than regenerating again.

- [x] **Step 8: Commit**

```bash
git add apps/backend/src apps/backend/codegen.ts apps/backend/schema.graphql apps/backend/tests
git commit -m "feat(backend): expose the transaction API

transactions takes limit and offset only. TransactionFilter belongs to slice 4
with the filter bar; declaring the argument now would put an untested parameter
in the public schema.

Transaction.category resolves through the per-request loader, and a transaction
whose category was deleted answers null rather than failing — onDelete: SetNull
keeps the history."
```

---

### Task 7: The development seed

`prisma/seed.ts`, deferred since slice 2 because it seeds both tables. Both now
exist. The frontend needs realistic data to build pagination against — twenty-
seven rows is what the design's footer shows — and a fixed seed makes
screenshots reproducible.

The seed user's credentials live in the seed file, not in `.env`, and the file
says plainly that it is for development only.

**Files:**
- Create: `apps/backend/prisma/seed.ts`
- Modify: `apps/backend/package.json` (the `prisma.seed` entry)
- Modify: `.gitguardian.yaml` (repo root) **only if** the scanner flags the file — see step 4.

**Interfaces:**
- Consumes: `hashPassword` from `src/shared/password.js`, `prisma` from `src/shared/prisma.js`.
- Produces: nothing importable. It is run with `npm run db:seed -w @financy/backend`.

- [x] **Step 1: Write the seed**

Create `apps/backend/prisma/seed.ts`:

```ts
/**
 * Development data. Not for any other environment: it deletes the seed user's
 * rows on every run and its password is in this file in plain text.
 *
 * Twenty-seven transactions across two months, because that is what the
 * transactions table in the design shows ("1 a 10 | 27 resultados") and because
 * pagination and the dashboard's month figures both need more than a handful of
 * rows to be worth looking at.
 */
import { prisma } from '../src/shared/prisma.js';
import { hashPassword } from '../src/shared/password.js';

const SEED_EMAIL = 'ana@financy.dev';
const SEED_PASSWORD = 'financy-dev-2026';

const CATEGORIES = [
  { name: 'Moradia', description: 'Aluguel e contas da casa', icon: 'HOME', color: 'BLUE' },
  { name: 'Mercado', description: 'Compras da semana', icon: 'SHOPPING_CART', color: 'GREEN' },
  { name: 'Transporte', description: null, icon: 'BUS', color: 'ORANGE' },
  { name: 'Saúde', description: 'Plano, farmácia e consultas', icon: 'HEART_PULSE', color: 'RED' },
  { name: 'Lazer', description: null, icon: 'TICKET', color: 'PURPLE' },
  { name: 'Educação', description: 'Cursos e livros', icon: 'BOOK_OPEN', color: 'YELLOW' },
  { name: 'Salário', description: 'Entrada mensal', icon: 'BRIEFCASE', color: 'PINK' },
] as const;

/**
 * Fixed rows rather than random ones: a screenshot taken today and one taken
 * next week should show the same numbers. Amounts are integer cents throughout —
 * 150_000 is R$ 1.500,00.
 */
const TRANSACTIONS = [
  { day: '2026-07-05', description: 'Salário de julho', amount: 780_000, type: 'INCOME', category: 'Salário' },
  { day: '2026-07-05', description: 'Aluguel', amount: 210_000, type: 'EXPENSE', category: 'Moradia' },
  { day: '2026-07-06', description: 'Conta de luz', amount: 18_740, type: 'EXPENSE', category: 'Moradia' },
  { day: '2026-07-07', description: 'Compras da semana', amount: 34_215, type: 'EXPENSE', category: 'Mercado' },
  { day: '2026-07-09', description: 'Recarga do bilhete único', amount: 10_000, type: 'EXPENSE', category: 'Transporte' },
  { day: '2026-07-11', description: 'Cinema', amount: 6_400, type: 'EXPENSE', category: 'Lazer' },
  { day: '2026-07-13', description: 'Farmácia', amount: 8_930, type: 'EXPENSE', category: 'Saúde' },
  { day: '2026-07-14', description: 'Compras da semana', amount: 29_880, type: 'EXPENSE', category: 'Mercado' },
  { day: '2026-07-16', description: 'Curso de inglês', amount: 32_000, type: 'EXPENSE', category: 'Educação' },
  { day: '2026-07-18', description: 'Freelance de design', amount: 120_000, type: 'INCOME', category: null },
  { day: '2026-07-19', description: 'Jantar fora', amount: 11_250, type: 'EXPENSE', category: 'Lazer' },
  { day: '2026-07-21', description: 'Compras da semana', amount: 31_470, type: 'EXPENSE', category: 'Mercado' },
  { day: '2026-07-23', description: 'Consulta médica', amount: 25_000, type: 'EXPENSE', category: 'Saúde' },
  { day: '2026-07-26', description: 'Internet', amount: 12_990, type: 'EXPENSE', category: 'Moradia' },
  { day: '2026-07-28', description: 'Compras da semana', amount: 27_640, type: 'EXPENSE', category: 'Mercado' },
  { day: '2026-08-03', description: 'Reembolso de passagem', amount: 8_500, type: 'INCOME', category: 'Transporte' },
  { day: '2026-08-05', description: 'Salário de agosto', amount: 780_000, type: 'INCOME', category: 'Salário' },
  { day: '2026-08-05', description: 'Aluguel', amount: 210_000, type: 'EXPENSE', category: 'Moradia' },
  { day: '2026-08-06', description: 'Conta de água', amount: 9_120, type: 'EXPENSE', category: 'Moradia' },
  { day: '2026-08-08', description: 'Compras da semana', amount: 35_910, type: 'EXPENSE', category: 'Mercado' },
  { day: '2026-08-10', description: 'Uber para o aeroporto', amount: 7_830, type: 'EXPENSE', category: 'Transporte' },
  { day: '2026-08-12', description: 'Livro de arquitetura', amount: 14_900, type: 'EXPENSE', category: 'Educação' },
  { day: '2026-08-14', description: 'Show', amount: 22_000, type: 'EXPENSE', category: 'Lazer' },
  { day: '2026-08-15', description: 'Compras da semana', amount: 30_050, type: 'EXPENSE', category: 'Mercado' },
  { day: '2026-08-17', description: 'Plano de saúde', amount: 48_700, type: 'EXPENSE', category: 'Saúde' },
  { day: '2026-08-19', description: 'Presente de aniversário', amount: 15_000, type: 'EXPENSE', category: null },
  { day: '2026-08-21', description: 'Venda de bicicleta usada', amount: 65_000, type: 'INCOME', category: null },
] as const;

/** Local midnight, matching what the date field in the app submits. */
function atLocalMidnight(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year!, month! - 1, date!);
}

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });

  // Scoped to the seed user only. A blanket deleteMany would wipe whatever the
  // developer was in the middle of testing with their own account.
  if (existing) await prisma.user.delete({ where: { id: existing.id } });

  const user = await prisma.user.create({
    data: {
      name: 'Ana Souza',
      email: SEED_EMAIL,
      passwordHash: await hashPassword(SEED_PASSWORD),
    },
  });

  const categoriesByName = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color,
      },
    });
    categoriesByName.set(category.name, created.id);
  }

  await prisma.transaction.createMany({
    data: TRANSACTIONS.map((transaction) => ({
      userId: user.id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      date: atLocalMidnight(transaction.day),
      categoryId: transaction.category
        ? (categoriesByName.get(transaction.category) ?? null)
        : null,
    })),
  });

  console.log(
    `Seeded ${SEED_EMAIL} with ${CATEGORIES.length} categories and ${TRANSACTIONS.length} transactions.`,
  );
  console.log(`Development password: ${SEED_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [x] **Step 2: Wire the script**

In `apps/backend/package.json`, add the script and the Prisma entry:

```json
  "scripts": {
    "db:seed": "tsx --env-file-if-exists=.env prisma/seed.ts"
  },
  "prisma": {
    "seed": "tsx --env-file-if-exists=.env prisma/seed.ts"
  }
```

Keep the existing scripts; `db:seed` goes beside `db:reset`. The `prisma.seed`
entry is what makes `prisma migrate reset` re-seed automatically.

- [x] **Step 3: Run it, twice**

```bash
rtk proxy "npm run db:seed -w @financy/backend"
rtk proxy "npm run db:seed -w @financy/backend"
```

Expected: both exit 0 with the same summary line. Running twice is the actual
test — the second run proves the delete-then-create is idempotent rather than
failing on the unique email or doubling the rows.

Confirm the counts:

```bash
rtk proxy "npx --workspace @financy/backend prisma db execute --stdin <<< 'SELECT COUNT(*) FROM \"Transaction\";'"
```

If that form is awkward, `npx prisma studio` from `apps/backend` shows the same
thing. Twenty-seven transactions, seven categories, one user.

- [x] **Step 4: Check the secret scanner**

`.gitguardian.yaml` exempts only `tests/helpers/credentials.ts` and
`src/test/credentials.ts`, so a password-shaped literal anywhere else is still
scanned. `SEED_PASSWORD` is one.

```bash
rtk proxy "git add apps/backend/prisma/seed.ts apps/backend/package.json"
rtk proxy "git status --porcelain"
```

If a pre-commit hook or a scanner run rejects the file, add
`apps/backend/prisma/seed.ts` to the exemption list in `.gitguardian.yaml` in
this same commit, with a comment saying it is a development-only fixture. Do
not weaken the rule more broadly, and do not move the password into `.env` —
`backend.md` §10 puts it in the file deliberately, so a developer can read it
without hunting.

- [x] **Step 5: Verify nothing else moved**

```bash
rtk proxy "git diff --cached apps/backend/package.json"
rtk proxy "npm test -w @financy/backend"
```

Expected: the `package.json` diff shows only the two additions — no dependency
version drifted. The suite still passes; the seed writes to `dev.db` and tests
use `test.db`.

- [x] **Step 6: Commit**

```bash
git commit -m "feat(backend): seed a development user with two months of data

Twenty-seven transactions across July and August, matching the row count in the
design's table footer, so pagination and the month figures can be built against
something realistic.

Deletes only the seed user before re-creating it, so running it twice does not
double the rows and does not touch whatever account the developer was testing
with."
```

---

### Task 8: Currency and date formatting

The frontend half starts here. `frontend.md` §14 names currency conversion as
one of two things to test with particular care, "where a silent
off-by-one-hundred lives". This task is that conversion, in one file, with the
two directions written as an inverse pair so they cannot drift.

The mask is cents-first: keystrokes fill from the right, so the field holds a
valid integer at every moment and submit sends it unchanged. There is no parse
step, no thousands-separator handling, and no locale ambiguity between `12,34`
and `12.34`.

`centsToDisplay` never divides. `1999 / 100` is not exactly `19.99` in binary
floating point, and while `Intl` happens to round it correctly today, building
the string from the integer removes the question entirely.

This task also installs three dependencies. `date-fns` is the one
`frontend.md` §2 already committed to and never got. `react` and `react-dom` are
declared for the first time — the installed 19.2.8 is present only transitively.

**Files:**
- Modify: `apps/frontend/package.json`, `apps/frontend/vite.config.ts`
- Create: `apps/frontend/src/lib/currency.ts`, `apps/frontend/src/lib/currency.test.ts`
- Create: `apps/frontend/src/lib/format.ts`, `apps/frontend/src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - `MAX_CENTS: 2147483647`
  - `centsToDisplay(cents: number): string`
  - `digitsToCents(raw: string): number`
  - `formatSignedAmount(cents: number, type: 'INCOME' | 'EXPENSE'): string`
  - `formatShortDate(iso: string): string`
  - `toDateInputValue(iso: string): string`
  - `fromDateInputValue(value: string): string`

- [x] **Step 1: Install the dependencies and pin the timezone**

```bash
rtk proxy "npm install date-fns react react-dom -w @financy/frontend"
rtk proxy "git diff apps/frontend/package.json"
```

Expected: three additions under `dependencies` and **no other version change**.
If any pinned major moved, revert and install with the version pinned.

In `apps/frontend/package.json`, set the timezone on both test scripts:

```json
    "test": "TZ=America/Sao_Paulo vitest run",
    "test:watch": "TZ=America/Sao_Paulo vitest",
```

Dates in this app are stored as local-midnight instants and rendered in local
time, which round-trips correctly — but only against a fixed zone. Without this
the date tests pass in São Paulo and fail in UTC, where a local-midnight instant
formats as the previous day.

- [x] **Step 2: Write the failing tests**

Create `apps/frontend/src/lib/currency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_CENTS,
  centsToDisplay,
  digitsToCents,
  formatSignedAmount,
} from '@/lib/currency';

describe('centsToDisplay', () => {
  it('renders whole reais', () => {
    expect(centsToDisplay(0)).toBe('R$ 0,00');
    expect(centsToDisplay(100)).toBe('R$ 1,00');
  });

  it('renders sub-real amounts with two digits', () => {
    expect(centsToDisplay(1)).toBe('R$ 0,01');
    expect(centsToDisplay(12)).toBe('R$ 0,12');
  });

  it('renders the value that floating point gets wrong', () => {
    // 1999 / 100 is not exactly 19.99 in binary floating point. This function
    // never divides, so there is nothing to round.
    expect(centsToDisplay(1_999)).toBe('R$ 19,99');
  });

  it('groups thousands the Brazilian way', () => {
    expect(centsToDisplay(150_000)).toBe('R$ 1.500,00');
    expect(centsToDisplay(123_456_789)).toBe('R$ 1.234.567,89');
  });

  it('renders the largest value the schema accepts', () => {
    // GraphQL Int is 32-bit signed.
    expect(centsToDisplay(MAX_CENTS)).toBe('R$ 21.474.836,47');
  });
});

describe('digitsToCents', () => {
  it('reads an empty field as zero', () => {
    expect(digitsToCents('')).toBe(0);
    expect(digitsToCents('R$ ,')).toBe(0);
  });

  it('fills from the right, one digit at a time', () => {
    expect(digitsToCents('1')).toBe(1);
    expect(digitsToCents('12')).toBe(12);
    expect(digitsToCents('123')).toBe(123);
    expect(digitsToCents('1234')).toBe(1_234);
  });

  it('ignores everything that is not a digit', () => {
    expect(digitsToCents('R$ 12,34')).toBe(1_234);
    expect(digitsToCents('R$ 1.234,56')).toBe(123_456);
    expect(digitsToCents('abc')).toBe(0);
  });

  it('clamps at the largest value the schema accepts', () => {
    // Better than sending a number the server answers with a GraphQL type
    // error the form has no field to attach.
    expect(digitsToCents('999999999999')).toBe(MAX_CENTS);
  });

  it('drops a leading zero rather than accumulating one', () => {
    expect(digitsToCents('0012')).toBe(12);
  });
});

describe('the pair round-trips', () => {
  it('returns the same integer it was given', () => {
    for (const cents of [0, 1, 12, 99, 100, 1_999, 150_000, 123_456_789]) {
      expect(digitsToCents(centsToDisplay(cents))).toBe(cents);
    }
  });
});

describe('formatSignedAmount', () => {
  it('signs an expense negative and income positive', () => {
    // The stored amount is unsigned — `type` carries the direction.
    expect(formatSignedAmount(1_234, 'EXPENSE')).toBe('-R$ 12,34');
    expect(formatSignedAmount(1_234, 'INCOME')).toBe('+R$ 12,34');
  });
});
```

Create `apps/frontend/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatShortDate,
  fromDateInputValue,
  toDateInputValue,
} from '@/lib/format';

describe('the test timezone is pinned', () => {
  it('runs in America/Sao_Paulo', () => {
    // Every assertion below depends on it. A failure here means the TZ was not
    // set on the test script, not that the formatters are wrong.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      'America/Sao_Paulo',
    );
  });
});

describe('formatShortDate', () => {
  it('renders DD/MM/YY, as the design shows', () => {
    expect(formatShortDate('2026-08-04T03:00:00.000Z')).toBe('04/08/26');
  });

  it('renders a local-midnight instant as its own day', () => {
    // The date field submits local midnight, which in UTC-3 is 03:00Z. Reading
    // it back in local time gives the day the user picked.
    expect(formatShortDate(fromDateInputValue('2026-01-31'))).toBe('31/01/26');
  });

  it('pads a single-digit day and month', () => {
    expect(formatShortDate(fromDateInputValue('2026-03-07'))).toBe('07/03/26');
  });
});

describe('the date input conversions round-trip', () => {
  it('returns the same day it was given', () => {
    for (const day of ['2026-01-01', '2026-02-28', '2026-08-04', '2026-12-31']) {
      expect(toDateInputValue(fromDateInputValue(day))).toBe(day);
    }
  });

  it('submits local midnight, not UTC midnight', () => {
    // new Date('2026-08-04') would be UTC midnight, which is the 3rd locally.
    expect(fromDateInputValue('2026-08-04')).toBe('2026-08-04T03:00:00.000Z');
  });
});
```

- [x] **Step 3: Run them to make sure they fail**

```bash
rtk proxy "npm test -w @financy/frontend -- src/lib/currency.test.ts src/lib/format.test.ts"
```

Expected: FAIL — neither module resolves.

- [x] **Step 4: Write the implementations**

Create `apps/frontend/src/lib/currency.ts`:

```ts
/**
 * Amounts cross the API as integer cents and are never a float on this side
 * either. `frontend.md` section 14 calls this the place a silent
 * off-by-one-hundred lives, so both directions live here, next to each other,
 * as an inverse pair.
 */

/** GraphQL `Int` is 32-bit signed — about R$ 21.474.836,47. */
export const MAX_CENTS = 2_147_483_647;

const GROUPING = new Intl.NumberFormat('pt-BR');

/**
 * Builds the string out of the integer rather than dividing by 100. `1999 / 100`
 * is not exactly `19.99` in binary floating point; not dividing means there is
 * nothing to round and nothing to get wrong.
 */
export function centsToDisplay(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(cents));
  const reais = Math.trunc(absolute / 100);
  const centavos = absolute % 100;

  return `${sign}R$ ${GROUPING.format(reais)},${String(centavos).padStart(2, '0')}`;
}

/**
 * Reads whatever is in the field as cents, filling from the right. Every
 * non-digit is dropped, so the formatted value this function's inverse produced
 * reads back as the integer it came from, and a paste of "R$ 1.234,56" works
 * without a locale parser.
 */
export function digitsToCents(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return 0;

  // Trimmed before Number() so a long paste cannot exceed MAX_SAFE_INTEGER on
  // the way to being clamped.
  return Math.min(Number(digits.slice(0, 15)), MAX_CENTS);
}

/**
 * The stored amount is unsigned — `type` carries the direction — and the design
 * puts the sign on the rendered value. `frontend.md` section 9.
 */
export function formatSignedAmount(
  cents: number,
  type: 'INCOME' | 'EXPENSE',
): string {
  return `${type === 'INCOME' ? '+' : '-'}${centsToDisplay(cents)}`;
}
```

Create `apps/frontend/src/lib/format.ts`:

```ts
import { format, parse, parseISO } from 'date-fns';

/**
 * Dates cross the API as ISO strings and are rendered in local time. The date
 * field submits local midnight, so a value written and read back lands on the
 * day the user picked — which is only true against a fixed zone, and why the
 * test script pins TZ.
 */
export function formatShortDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yy');
}

/** ISO instant to the `yyyy-MM-dd` an `<input type="date">` expects. */
export function toDateInputValue(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

/**
 * `yyyy-MM-dd` back to an ISO instant at **local** midnight. `new Date(value)`
 * would parse it as UTC midnight, which is the previous day everywhere west of
 * Greenwich — the whole audience of this application.
 */
export function fromDateInputValue(value: string): string {
  return parse(value, 'yyyy-MM-dd', new Date()).toISOString();
}
```

- [x] **Step 5: Run them to make sure they pass**

```bash
rtk proxy "npm test -w @financy/frontend -- src/lib/currency.test.ts src/lib/format.test.ts"
rtk proxy "npm run typecheck -w @financy/frontend"
```

Expected: both exit 0. If the timezone guard fails, step 1's script change did
not land — fix that rather than changing the expected strings.

- [x] **Step 6: Commit**

```bash
git add apps/frontend/package.json apps/frontend/vite.config.ts apps/frontend/src/lib package-lock.json
git commit -m "feat(frontend): convert cents to currency and ISO to dates

centsToDisplay builds the string from the integer instead of dividing by 100,
so the value floating point gets wrong has nothing to round.

Declares react and react-dom, which appeared in no package.json and were
present only transitively, and pins TZ on the test scripts — a local-midnight
instant renders as the previous day in UTC."
```

---

### Task 9: Typed transaction operations

The four documents and the hooks generated from them. Nothing renders yet; this
task exists on its own because a codegen failure is much easier to read when it
is the only thing in the commit.

The mutations ask for the id and nothing else, matching `categories.graphql`.
The lists refetch through explicit invalidation, so selecting more fields would
produce a second copy of data nothing reads.

**Files:**
- Create: `apps/frontend/src/graphql/operations/transactions.graphql`
- Regenerate: `apps/frontend/src/graphql/generated/graphql.ts`
- Create: `apps/frontend/src/graphql/operations/transactions.test.ts`

**Interfaces:**
- Consumes: `apps/backend/schema.graphql` as regenerated by task 6.
- Produces: `useTransactionsQuery` (with `.getKey`), `useCreateTransactionMutation`, `useUpdateTransactionMutation`, `useDeleteTransactionMutation`, and the `TransactionsQuery` type. Tasks 12 to 14 consume all of them.

- [x] **Step 1: Write the documents**

Create `apps/frontend/src/graphql/operations/transactions.graphql`:

```graphql
# createdAt and updatedAt are on the type and nothing renders them — the table
# shows the transaction's own date. Selecting them would put two more fields in
# every cache entry for no reader.
query Transactions($limit: Int, $offset: Int) {
  transactions(limit: $limit, offset: $offset) {
    totalCount
    items {
      id
      description
      amount
      type
      date
      category {
        id
        name
        icon
        color
      }
    }
  }
}

# The mutations ask for the id and nothing else, as the category ones do. The
# lists are refetched through explicit invalidation, so selecting more here
# would only produce a second copy of the same data that nothing reads.
mutation CreateTransaction($input: CreateTransactionInput!) {
  createTransaction(input: $input) {
    id
  }
}

mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
  updateTransaction(id: $id, input: $input) {
    id
  }
}

mutation DeleteTransaction($id: ID!) {
  deleteTransaction(id: $id)
}
```

- [x] **Step 2: Write the failing test**

Create `apps/frontend/src/graphql/operations/transactions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { useTransactionsQuery } from '@/graphql/generated/graphql';

describe('the generated transactions query key', () => {
  it('starts with the literal DeleteCategoryDialog already invalidates', () => {
    // Slice 2 shipped queryClient.invalidateQueries({ queryKey: ['Transactions'] })
    // with no consumer, betting on this name. TanStack matches by prefix, so
    // the bare literal has to be the first element or that invalidation is a
    // silent no-op and a deleted category leaves stale tags on every row.
    expect(useTransactionsQuery.getKey({ limit: 10, offset: 0 })[0]).toBe(
      'Transactions',
    );
  });

  it('separates one page from another', () => {
    expect(useTransactionsQuery.getKey({ limit: 10, offset: 0 })).not.toEqual(
      useTransactionsQuery.getKey({ limit: 10, offset: 10 }),
    );
  });
});
```

- [x] **Step 3: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/frontend -- src/graphql/operations/transactions.test.ts"
```

Expected: FAIL — `useTransactionsQuery` is not exported.

- [x] **Step 4: Generate**

```bash
rtk proxy "npm run codegen -w @financy/frontend"
```

Then confirm the enums came through as unions rather than TypeScript enums:

```bash
rtk proxy "grep -n \"TransactionType =\" apps/frontend/src/graphql/generated/graphql.ts"
```

Expected: a string-literal union (`'EXPENSE' | 'INCOME'`), because `codegen.ts`
sets `enumsAsTypes`. A real `enum` here would need a cast at every call site.

- [x] **Step 5: Run it to make sure it passes**

```bash
rtk proxy "npm test -w @financy/frontend -- src/graphql/operations/transactions.test.ts"
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run codegen:check -w @financy/frontend"
```

Expected: three exit 0s.

- [x] **Step 6: Commit**

```bash
git add apps/frontend/src/graphql
git commit -m "feat(frontend): generate typed transaction hooks

A test asserts the query key starts with the 'Transactions' literal that
DeleteCategoryDialog already invalidates. TanStack matches by prefix, so a
different name would make that invalidation a silent no-op and leave stale
category tags on every row after a category is deleted."
```

---

### Task 10: The segmented control, and decoupling the pickers

Two design-system changes, together because they are the same change: a
primitive should take a value and report a change, not take React Hook Form's
`UseFormRegisterReturn`.

`IconPicker` and `ColorPicker` currently do take one, which couples two
primitives in `components/ui/` to a form library — visible in the style guide,
which has to hand-fake a registration object to render them. The new
`SegmentedControl` would be the third. Slice 2's review raised this; the fix
lands here because this is the task that would otherwise repeat the mistake.

The consumers move from `register` to `Controller`, which is the same amount of
code and works for any control.

**Files:**
- Create: `apps/frontend/src/components/ui/SegmentedControl.tsx`, `SegmentedControl.test.tsx`
- Modify: `apps/frontend/src/components/ui/IconPicker.tsx`, `ColorPicker.tsx` and their tests
- Modify: `apps/frontend/src/features/categories/CategoryDialog.tsx`
- Modify: `apps/frontend/src/pages/StyleGuide.tsx` and its test

**Interfaces:**
- Produces:
  - `interface SegmentedOption<T> { value: T; label: string; tone: 'danger' | 'success' }`
  - `SegmentedControl<T extends string>(props: { legend: string; name: string; value: T; options: SegmentedOption<T>[]; onChange: (value: T) => void }): JSX.Element`
  - `IconPicker` and `ColorPicker` now take `{ legend, name, value, onChange }`, dropping `registration`.

- [x] **Step 1: Write the failing test**

Create `apps/frontend/src/components/ui/SegmentedControl.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const OPTIONS = [
  { value: 'EXPENSE', label: 'Despesa', tone: 'danger' },
  { value: 'INCOME', label: 'Receita', tone: 'success' },
] as const;

describe('SegmentedControl', () => {
  it('renders one radio per option, named by its label', () => {
    render(
      <SegmentedControl
        legend="Tipo"
        name="type"
        value="EXPENSE"
        options={[...OPTIONS]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Despesa' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Receita' })).toBeInTheDocument();
  });

  it('marks the current value as checked', () => {
    render(
      <SegmentedControl
        legend="Tipo"
        name="type"
        value="INCOME"
        options={[...OPTIONS]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Receita' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Despesa' })).not.toBeChecked();
  });

  it('reports the new value when another option is chosen', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        legend="Tipo"
        name="type"
        value="EXPENSE"
        options={[...OPTIONS]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Receita' }));

    // The value, not the event. A primitive that hands back a change event
    // makes every consumer reach into event.target.
    expect(onChange).toHaveBeenCalledWith('INCOME');
  });

  it('groups the options under the legend', () => {
    render(
      <SegmentedControl
        legend="Tipo"
        name="type"
        value="EXPENSE"
        options={[...OPTIONS]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Tipo' })).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/frontend -- src/components/ui/SegmentedControl.test.tsx"
```

Expected: FAIL — the module does not resolve.

- [x] **Step 3: Write the primitive**

Create `apps/frontend/src/components/ui/SegmentedControl.tsx`:

```tsx
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  tone: 'danger' | 'success';
}

export interface SegmentedControlProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

// Spelled out, never interpolated: Tailwind scans source text for whole class
// names, so `bg-${tone}` compiles to nothing and the segment renders unstyled.
const SELECTED = {
  danger: 'border-danger bg-red-light text-red-dark',
  success: 'border-success bg-green-light text-green-dark',
} as const;

/**
 * A native radio group behind two labels. One tab stop, arrow keys between the
 * options and the right announcement, none of which has to be written here.
 *
 * Takes a value and reports a value. It knows nothing about React Hook Form —
 * a consumer wires it with `Controller`, which works for any form library and
 * for no form library at all.
 */
export function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-gray-700">
        {legend}
      </legend>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex h-11 items-center justify-center rounded-lg border text-sm font-medium',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-base/30',
                  selected
                    ? SELECTED[option.tone]
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100',
                )}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [x] **Step 4: Run it to make sure it passes**

```bash
rtk proxy "npm test -w @financy/frontend -- src/components/ui/SegmentedControl.test.tsx"
```

Expected: PASS.

- [x] **Step 5: Decouple the two pickers**

In `apps/frontend/src/components/ui/IconPicker.tsx`, replace the props and the
input wiring. Delete the `UseFormRegisterReturn` import:

```tsx
export interface IconPickerProps {
  legend: string;
  name: string;
  value: CategoryIcon;
  onChange: (value: CategoryIcon) => void;
}
```

```tsx
export function IconPicker({ legend, name, value, onChange }: IconPickerProps) {
```

and inside the map, the input becomes:

```tsx
              <input
                type="radio"
                name={name}
                value={token}
                checked={selected}
                onChange={() => onChange(token)}
                aria-label={CATEGORY_ICON_LABELS[token]}
                className="peer sr-only"
              />
```

Note `checked` rather than `defaultChecked`: the control is now driven by the
`value` prop, so it has to re-render when that prop changes.

Apply the same three changes to `apps/frontend/src/components/ui/ColorPicker.tsx`,
with `CategoryColor` and `CATEGORY_COLOR_LABELS`.

Update both tests: replace the `registration()` helper with an `onChange` spy
and assert the token, not the event.

```tsx
  it('reports the chosen token', async () => {
    const onChange = vi.fn();
    render(
      <IconPicker legend="Ícone" name="icon" value="WALLET" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Ônibus' }));

    expect(onChange).toHaveBeenCalledWith('BUS');
  });
```

- [x] **Step 6: Move `CategoryDialog` to `Controller`**

In `apps/frontend/src/features/categories/CategoryDialog.tsx`, replace the
`useWatch` calls and the two picker elements. Extend the import:

```tsx
import { Controller, useForm } from 'react-hook-form';
```

Delete the `useWatch` import and both `const icon = useWatch(...)` lines —
`Controller` subscribes on its own, which is what `useWatch` was standing in
for.

```tsx
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <IconPicker
              legend="Ícone"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ColorPicker
              legend="Cor"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
```

- [x] **Step 7: Update the style guide**

In `apps/frontend/src/pages/StyleGuide.tsx`, the two pickers no longer need a
faked registration object. Give the page local state instead, and add the
segmented control beside them:

```tsx
  const [guideIcon, setGuideIcon] = useState<CategoryIcon>('WALLET');
  const [guideColor, setGuideColor] = useState<CategoryColor>('GREEN');
  const [guideType, setGuideType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
```

```tsx
        <IconPicker
          legend="Ícone"
          name="style-guide-icon"
          value={guideIcon}
          onChange={setGuideIcon}
        />

        <ColorPicker
          legend="Cor"
          name="style-guide-color"
          value={guideColor}
          onChange={setGuideColor}
        />

        <SegmentedControl
          legend="Tipo"
          name="style-guide-type"
          value={guideType}
          options={[
            { value: 'EXPENSE', label: 'Despesa', tone: 'danger' },
            { value: 'INCOME', label: 'Receita', tone: 'success' },
          ]}
          onChange={setGuideType}
        />
```

Add a case to `StyleGuide.test.tsx` asserting both segments render, so the
gallery cannot lose the control silently.

- [x] **Step 8: Run the frontend suite**

```bash
rtk proxy "npm test -w @financy/frontend"
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
```

Expected: three exit 0s. `CategoryDialog.test.tsx` should pass untouched — the
pickers still render native radios with the same accessible names, which is what
those tests address.

- [x] **Step 9: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(frontend): add a segmented control and decouple the pickers

IconPicker and ColorPicker took a UseFormRegisterReturn, coupling two
design-system primitives to React Hook Form — visible in the style guide, which
had to hand-fake one. They now take name/value/onChange, and their consumer
wires them with Controller.

The new SegmentedControl would have been the third primitive to take a
registration, which is why the refactor lands with it rather than after it."
```

---

### Task 11: Shared panel states, and the accessibility carry-overs

Four findings from slice 2's review, done now because task 14 would otherwise
copy every one of them into the transactions page.

`PanelError` and the loading skeleton are both defined inside
`CategoriesPage.tsx`. The transactions page needs the same two. Copying them is
how a design system stops being the source of truth.

The skeleton containers carry `aria-label` on a plain `div`, which is not
reliably exposed to assistive technology. The tests read the attribute directly
with `getByLabelText`, so this looks covered and is not. `role="status"` with
`aria-busy` is what actually announces.

`PanelError` has no `role="alert"`, so a failed refetch announces nothing at
all.

On a category card, delete precedes edit in DOM order, which puts the
destructive action first for anyone tabbing through twelve cards.

**Files:**
- Create: `apps/frontend/src/components/ui/PanelError.tsx`, `PanelError.test.tsx`
- Create: `apps/frontend/src/components/ui/Skeleton.tsx`, `Skeleton.test.tsx`
- Modify: `apps/frontend/src/features/categories/CategoriesPage.tsx` and its test
- Modify: `apps/frontend/src/features/categories/CategoryCard.tsx` and its test

**Interfaces:**
- Produces:
  - `PanelError(props: { message: string; onRetry: () => void }): JSX.Element`
  - `Skeleton(props: { label: string; count: number; className?: string; containerClassName?: string }): JSX.Element`

  Task 14 uses both.

- [x] **Step 1: Write the failing tests**

Create `apps/frontend/src/components/ui/PanelError.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelError } from '@/components/ui/PanelError';

describe('PanelError', () => {
  it('announces itself', () => {
    // Without role="alert" a failed refetch changes the screen and says
    // nothing.
    render(<PanelError message="Não foi possível carregar" onRetry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar',
    );
  });

  it('offers a retry', async () => {
    const onRetry = vi.fn();
    render(<PanelError message="Falhou" onRetry={onRetry} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

Create `apps/frontend/src/components/ui/Skeleton.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '@/components/ui/Skeleton';

describe('Skeleton', () => {
  it('announces that something is loading', () => {
    // aria-label on a plain div is not reliably exposed. The old tests read the
    // attribute directly with getByLabelText, which passed against markup no
    // screen reader announced.
    render(<Skeleton label="Carregando transações" count={3} />);

    const status = screen.getByRole('status', {
      name: 'Carregando transações',
    });

    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('renders one placeholder per count', () => {
    render(<Skeleton label="Carregando" count={4} />);

    expect(
      screen.getByRole('status').querySelectorAll('[data-slot="skeleton-item"]'),
    ).toHaveLength(4);
  });
});
```

- [x] **Step 2: Run them to make sure they fail**

```bash
rtk proxy "npm test -w @financy/frontend -- src/components/ui/PanelError.test.tsx src/components/ui/Skeleton.test.tsx"
```

Expected: FAIL — neither module resolves.

- [x] **Step 3: Write the two primitives**

Create `apps/frontend/src/components/ui/PanelError.tsx`:

```tsx
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface PanelErrorProps {
  message: string;
  onRetry: () => void;
}

/**
 * The error state, scoped to the panel that failed rather than replacing the
 * page. `frontend.md` section 10.
 *
 * role="alert" because the panel it replaces was already on screen: without it
 * the content changes and nothing is announced.
 */
export function PanelError({ message, onRetry }: PanelErrorProps) {
  return (
    <Card
      role="alert"
      className="flex flex-col items-center gap-3 p-8 text-center"
    >
      <p className="text-sm text-gray-600">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Card>
  );
}
```

Create `apps/frontend/src/components/ui/Skeleton.tsx`:

```tsx
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export interface SkeletonProps {
  label: string;
  count: number;
  /** Applied to each placeholder — this is where the shape comes from. */
  className?: string;
  containerClassName?: string;
}

/**
 * Placeholders shaped like the content they replace, not a spinner over the
 * page. `frontend.md` section 10.
 *
 * role="status" with aria-busy, not aria-label on a div: a label on a plain div
 * has no role to attach to and is not reliably exposed, which is what slice 2's
 * review caught.
 */
export function Skeleton({
  label,
  count,
  className,
  containerClassName,
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={containerClassName}
    >
      {Array.from({ length: count }, (_, index) => (
        <Card
          key={index}
          data-slot="skeleton-item"
          className={cn('animate-pulse bg-gray-200', className)}
        />
      ))}
    </div>
  );
}
```

- [x] **Step 4: Adopt them in `CategoriesPage`**

Delete the local `PanelError` and `GridSkeleton` definitions from
`apps/frontend/src/features/categories/CategoriesPage.tsx` and import the
primitives. The three call sites become:

```tsx
        {stats.isPending ? (
          <Skeleton
            label="Carregando números"
            count={3}
            className="h-24 p-5"
            containerClassName="grid gap-4 sm:grid-cols-3"
          />
        ) : stats.isError || !stats.data ? (
```

```tsx
      {categories.isPending ? (
        <Skeleton
          label="Carregando categorias"
          count={4}
          className="h-40 p-5"
          containerClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        />
      ) : categories.isError || !categories.data ? (
```

The `PanelError` usages need no change beyond the import.

In `CategoriesPage.test.tsx`, replace every `getByLabelText('Carregando …')`
with `getByRole('status', { name: 'Carregando …' })`. That substitution is the
point of the change: the old query passed against markup that announced
nothing.

- [x] **Step 5: Fix the card's DOM order and heading**

In `apps/frontend/src/features/categories/CategoryCard.tsx`, swap the two
`IconButton`s so edit comes first, and promote the name:

```tsx
        <div className="flex gap-2">
          {/* Edit first. Delete first put the destructive action ahead of the
              safe one for anyone tabbing through twelve cards. */}
          <IconButton
            icon={Pencil}
            label={`Editar ${name}`}
            onClick={() => onEdit(category)}
          />
          <IconButton
            icon={Trash2}
            label={`Excluir ${name}`}
            variant="danger"
            onClick={() => onDelete(category)}
          />
        </div>
```

```tsx
        <h3 className="font-semibold text-gray-800">{name}</h3>
```

Add a case to `CategoryCard.test.tsx` pinning the order, so it cannot silently
revert:

```tsx
  it('puts edit before delete in tab order', () => {
    render(
      <CategoryCard
        category={category}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole('button');

    expect(buttons[0]).toHaveAccessibleName('Editar Mercado');
    expect(buttons[1]).toHaveAccessibleName('Excluir Mercado');
  });
```

- [x] **Step 6: Run the frontend suite**

```bash
rtk proxy "npm test -w @financy/frontend"
rtk proxy "npm run typecheck -w @financy/frontend"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
```

Expected: four exit 0s.

- [x] **Step 7: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(frontend): extract the panel states and fix what they hid

PanelError and the loading skeleton lived inside CategoriesPage, and the
transactions page needs both.

The skeletons carried aria-label on a plain div, which is not reliably exposed;
the tests read the attribute directly, so this looked covered and was not. They
now use role=status with aria-busy, and PanelError announces through
role=alert. On a card, edit now precedes delete, and the name is a heading."
```

---

### Task 12: The transaction dialog

One form serving create and edit, as the category dialog does. Same fields, same
validation, different title and different mutation.

The dialog is mounted only while open. Slice 2's review found the opposite —
a permanently mounted dialog keyed on its edit target — reopening with the
previous values and a stale error banner. Adding several transactions in a row
is the primary flow here, so the same defect would be worse.

The amount field is where task 8's mask meets the form. The field holds an
integer for its whole life; `centsToDisplay` is only ever called to render it.

**Files:**
- Create: `apps/frontend/src/features/transactions/validation.ts`
- Create: `apps/frontend/src/features/transactions/TransactionDialog.tsx`, `TransactionDialog.test.tsx`

**Interfaces:**
- Consumes: `SegmentedControl` (task 10); `centsToDisplay`, `digitsToCents`, `toDateInputValue`, `fromDateInputValue` (task 8); the generated hooks (task 9).
- Produces:
  - `transactionFormSchema`, `type TransactionFormValues = { description: string; amount: number; type: 'INCOME' | 'EXPENSE'; date: string; categoryId: string }`
  - `interface TransactionFormTarget { id: string; description: string; amount: number; type: 'INCOME' | 'EXPENSE'; date: string; categoryId: string | null }`
  - `TransactionDialog(props: { open: boolean; onClose: () => void; transaction?: TransactionFormTarget | null }): JSX.Element`

  Task 14 mounts it. `date` on the form is the `yyyy-MM-dd` the input holds;
  `date` on the target is the ISO string the API returned.

- [x] **Step 1: Write the form schema**

Create `apps/frontend/src/features/transactions/validation.ts`:

```ts
import { z } from 'zod';

/**
 * Mirrors `backend.md` section 7. Client validation is for feedback speed; the
 * server validates independently and is the only thing that decides what is
 * stored. Keeping the numbers identical is what stops the two from disagreeing
 * about the same input.
 */
export const transactionFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Informe uma descrição')
    .max(200, 'A descrição deve ter no máximo 200 caracteres'),
  // Already an integer number of cents — the field is masked, so there is no
  // decimal string to parse here or anywhere else.
  amount: z
    .int()
    .refine((value) => value !== 0, 'Informe um valor maior que zero'),
  type: z.enum(['EXPENSE', 'INCOME'], { error: 'Selecione um tipo' }),
  // The yyyy-MM-dd an <input type="date"> holds, converted on submit.
  date: z.string().min(1, 'Informe uma data'),
  // An empty string is "sem categoria", which the API takes as null.
  categoryId: z.string(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
```

- [x] **Step 2: Write the failing test**

Create `apps/frontend/src/features/transactions/TransactionDialog.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, graphqlError, ok } from '@/test/msw/api';
import { TransactionDialog } from '@/features/transactions/TransactionDialog';

const CATEGORIES = [
  {
    id: 'category-1',
    name: 'Mercado',
    description: null,
    icon: 'SHOPPING_CART',
    color: 'GREEN',
    transactionCount: 3,
  },
];

function mockCategories() {
  server.use(api.query('Categories', () => ok({ categories: CATEGORIES })));
}

beforeEach(mockCategories);

describe('TransactionDialog, creating', () => {
  it('sends the typed amount as integer cents', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('CreateTransaction', ({ variables: received }) => {
        variables(received);
        return ok({ createTransaction: { id: 'transaction-1' } });
      }),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(
      await screen.findByLabelText('Descrição'),
      'Compras da semana',
    );
    // Cents-first: four keystrokes are R$ 12,34.
    await userEvent.type(screen.getByLabelText('Valor'), '1234');
    await userEvent.clear(screen.getByLabelText('Data'));
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-04');
    await userEvent.selectOptions(
      screen.getByLabelText('Categoria'),
      'category-1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(variables).toHaveBeenCalled());
    expect(variables.mock.calls[0]?.[0]).toEqual({
      input: {
        description: 'Compras da semana',
        amount: 1_234,
        type: 'EXPENSE',
        date: '2026-08-04T03:00:00.000Z',
        categoryId: 'category-1',
      },
    });
  });

  it('shows the masked value as the user types', async () => {
    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    const amount = await screen.findByLabelText('Valor');
    expect(amount).toHaveValue('R$ 0,00');

    await userEvent.type(amount, '1');
    expect(amount).toHaveValue('R$ 0,01');

    await userEvent.type(amount, '2');
    expect(amount).toHaveValue('R$ 0,12');

    await userEvent.type(amount, '34');
    expect(amount).toHaveValue('R$ 12,34');
  });

  it('sends a null category when none is chosen', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('CreateTransaction', ({ variables: received }) => {
        variables(received);
        return ok({ createTransaction: { id: 'transaction-1' } });
      }),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Troco');
    await userEvent.type(screen.getByLabelText('Valor'), '500');
    await userEvent.click(screen.getByRole('radio', { name: 'Receita' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(variables).toHaveBeenCalled());
    const input = (variables.mock.calls[0]?.[0] as { input: Record<string, unknown> })
      .input;
    expect(input.categoryId).toBeNull();
    expect(input.type).toBe('INCOME');
  });

  it('refuses an empty description without calling the API', async () => {
    const called = vi.fn();
    server.use(
      api.mutation('CreateTransaction', () => {
        called();
        return ok({ createTransaction: { id: 'x' } });
      }),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe uma descrição')).toBeInTheDocument();
    expect(called).not.toHaveBeenCalled();
  });

  it('refuses a zero amount', async () => {
    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Nada');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Informe um valor maior que zero'),
    ).toBeInTheDocument();
  });

  it('refetches every list the new row changed', async () => {
    server.use(
      api.mutation('CreateTransaction', () =>
        ok({ createTransaction: { id: 'transaction-1' } }),
      ),
    );

    const onClose = vi.fn();
    const { queryClient } = renderWithProviders(
      <TransactionDialog open onClose={onClose} />,
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Mercado');
    await userEvent.type(screen.getByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const keys = invalidate.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey[0],
    );
    // Both category lists carry counts and totals this row changed, and the
    // dashboard's summary does too. frontend.md section 6.
    expect(keys).toEqual(
      expect.arrayContaining([
        'Transactions',
        'Categories',
        'CategoryStats',
        'Summary',
      ]),
    );
  });

  it('surfaces a server field error on its own field', async () => {
    server.use(
      api.mutation('CreateTransaction', () =>
        graphqlError('BAD_USER_INPUT', 'Erro', {
          description: ['A descrição é obrigatória'],
        }),
      ),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Mercado');
    await userEvent.type(screen.getByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('A descrição é obrigatória'),
    ).toBeInTheDocument();
  });

  it('shows a form-level error when the save fails for another reason', async () => {
    server.use(
      api.mutation('CreateTransaction', () => graphqlError('NOT_FOUND')),
    );

    renderWithProviders(<TransactionDialog open onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Descrição'), 'Mercado');
    await userEvent.type(screen.getByLabelText('Valor'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar. Tente novamente.',
    );
  });
});

describe('TransactionDialog, editing', () => {
  const target = {
    id: 'transaction-1',
    description: 'Aluguel',
    amount: 210_000,
    type: 'EXPENSE' as const,
    date: '2026-08-05T03:00:00.000Z',
    categoryId: 'category-1',
  };

  it('opens holding the current values', async () => {
    renderWithProviders(
      <TransactionDialog open onClose={vi.fn()} transaction={target} />,
    );

    expect(await screen.findByLabelText('Descrição')).toHaveValue('Aluguel');
    expect(screen.getByLabelText('Valor')).toHaveValue('R$ 2.100,00');
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05');
    expect(screen.getByLabelText('Categoria')).toHaveValue('category-1');
    expect(screen.getByRole('radio', { name: 'Despesa' })).toBeChecked();
    expect(
      screen.getByRole('heading', { name: 'Editar transação' }),
    ).toBeInTheDocument();
  });

  it('sends only an update', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('UpdateTransaction', ({ variables: received }) => {
        variables(received);
        return ok({ updateTransaction: { id: target.id } });
      }),
    );

    renderWithProviders(
      <TransactionDialog open onClose={vi.fn()} transaction={target} />,
    );

    const description = await screen.findByLabelText('Descrição');
    await userEvent.clear(description);
    await userEvent.type(description, 'Aluguel de agosto');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(variables).toHaveBeenCalled());
    expect(variables.mock.calls[0]?.[0]).toMatchObject({
      id: 'transaction-1',
      input: { description: 'Aluguel de agosto', amount: 210_000 },
    });
  });
});
```

- [x] **Step 3: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/transactions/TransactionDialog.test.tsx"
```

Expected: FAIL — the module does not resolve.

- [x] **Step 4: Write the dialog**

Create `apps/frontend/src/features/transactions/TransactionDialog.tsx`:

```tsx
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/useToast';
import {
  useCategoriesQuery,
  useCategoryStatsQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
} from '@/graphql/generated/graphql';
import { fieldErrorsOf } from '@/lib/graphql-errors';
import { centsToDisplay, digitsToCents } from '@/lib/currency';
import { fromDateInputValue, toDateInputValue } from '@/lib/format';
import {
  transactionFormSchema,
  type TransactionFormValues,
} from './validation';

export interface TransactionFormTarget {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  /** The ISO instant the API returned. */
  date: string;
  categoryId: string | null;
}

export interface TransactionDialogProps {
  open: boolean;
  onClose: () => void;
  transaction?: TransactionFormTarget | null;
}

const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Despesa', tone: 'danger' },
  { value: 'INCOME', label: 'Receita', tone: 'success' },
] as const;

const UNCATEGORIZED = '';

/** Today, in the format the date input wants. */
function today(): string {
  return toDateInputValue(new Date().toISOString());
}

export function TransactionDialog({
  open,
  onClose,
  transaction,
}: TransactionDialogProps) {
  const editing = Boolean(transaction);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  // The category list, for the select. It is already in the cache whenever the
  // categories page has been visited; here it is just another query.
  const categories = useCategoriesQuery();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: transaction?.description ?? '',
      amount: transaction?.amount ?? 0,
      type: transaction?.type ?? 'EXPENSE',
      date: transaction ? toDateInputValue(transaction.date) : today(),
      categoryId: transaction?.categoryId ?? UNCATEGORIZED,
    },
  });

  const createTransaction = useCreateTransactionMutation();
  const updateTransaction = useUpdateTransactionMutation();
  // isSubmitting, not the mutation's isPending: isPending flips false the
  // moment mutateAsync resolves, while the dialog stays open and interactive
  // through the awaited invalidation below. isSubmitting stays true for the
  // whole handler, so a second click in that window cannot fire a second save.
  const pending = form.formState.isSubmitting;

  async function invalidate() {
    await Promise.all([
      // The bare literal, not getKey(variables): every page of the list is its
      // own cache entry and TanStack matches by prefix, so this invalidates all
      // of them rather than only the page that happened to be open.
      queryClient.invalidateQueries({ queryKey: ['Transactions'] }),
      // Both category lists carry per-category counts and totals this row
      // changed. frontend.md section 6.
      queryClient.invalidateQueries({ queryKey: useCategoriesQuery.getKey() }),
      queryClient.invalidateQueries({
        queryKey: useCategoryStatsQuery.getKey(),
      }),
      // The dashboard's figures, which slice 5 renders. Invalidating a key with
      // no consumer costs nothing and is what makes that slice correct on
      // arrival — the same bet slice 2 made on ['Transactions'].
      queryClient.invalidateQueries({ queryKey: ['Summary'] }),
    ]);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    const input = {
      description: values.description,
      amount: values.amount,
      type: values.type,
      date: fromDateInputValue(values.date),
      // An empty select is "sem categoria". The API takes null for that.
      categoryId: values.categoryId === UNCATEGORIZED ? null : values.categoryId,
    };

    try {
      if (transaction) {
        await updateTransaction.mutateAsync({ id: transaction.id, input });
      } else {
        await createTransaction.mutateAsync({ input });
      }

      await invalidate();
      showToast(editing ? 'Transação atualizada' : 'Transação criada');
      onClose();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      const named = (['description', 'amount', 'date', 'categoryId'] as const)
        .find((field) => fieldErrors[field]?.[0]);

      if (named) {
        form.setError(named, { message: fieldErrors[named]?.[0] });
        return;
      }

      setFormError('Não foi possível salvar. Tente novamente.');
    }
  });

  const loadedCategories = categories.data?.categories ?? [];
  const categoryOptions = [
    { value: UNCATEGORIZED, label: 'Sem categoria' },
    ...loadedCategories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  // The list loads asynchronously, but a transaction being edited already
  // has a categoryId at mount. A controlled select can only hold a value
  // that matches one of its <option>s, so the currently assigned category
  // needs a placeholder slot until the real list arrives and replaces it —
  // by the same value, so React just swaps the label in place.
  if (
    transaction?.categoryId &&
    !loadedCategories.some(
      (category) => category.id === transaction.categoryId,
    )
  ) {
    categoryOptions.push({ value: transaction.categoryId, label: '…' });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Editar transação' : 'Nova transação'}
      subtitle="Registre sua despesa ou receita"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark"
          >
            {formError}
          </p>
        )}

        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <SegmentedControl
              legend="Tipo"
              name={field.name}
              value={field.value}
              options={[...TYPE_OPTIONS]}
              onChange={field.onChange}
            />
          )}
        />

        <Input
          label="Descrição"
          placeholder="Compras da semana"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Data"
            type="date"
            error={form.formState.errors.date?.message}
            {...form.register('date')}
          />

          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Input
                label="Valor"
                inputMode="numeric"
                // The field holds an integer for its whole life. This is the
                // only place cents become a string, and digitsToCents is its
                // exact inverse — see lib/currency.ts.
                value={centsToDisplay(field.value)}
                onChange={(event) =>
                  field.onChange(digitsToCents(event.target.value))
                }
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                error={form.formState.errors.amount?.message}
              />
            )}
          />
        </div>

        {/*
          Controller-driven, not form.register: react-hook-form 7.84.0 sets
          select.value during updateValidAndValue on the ref callback's first
          attach, which is before the async category list has rendered
          anything but the empty placeholder <option> — so the DOM value
          becomes ''. Every later render's ref callback short-circuits at
          `fieldRef === field._f.ref` before updateValidAndValue runs again,
          so nothing ever re-applies the value once the real options arrive.
          An uncontrolled register on this field can never pass the
          `toHaveValue('category-1')` assertion in Step 2's test. Controller
          plus the placeholder <option> above is the minimal fix.
        */}
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <Select
              label="Categoria"
              options={categoryOptions}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              error={form.formState.errors.categoryId?.message}
            />
          )}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [x] **Step 5: Run it to make sure it passes**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/transactions/TransactionDialog.test.tsx"
rtk proxy "npm run typecheck -w @financy/frontend"
```

Expected: both exit 0.

If the masked-typing test fails on the second keystroke, the `Input` is being
remounted between renders — check that the `Controller` `render` prop is not
creating a new component type each pass. If `userEvent.type` on the date input
misbehaves, set the value with `fireEvent.change`; jsdom's date input does not
accept keystrokes the way a browser does.

- [x] **Step 6: Commit**

```bash
git add apps/frontend/src/features/transactions
git commit -m "feat(frontend): add the transaction dialog

Create and edit from one form. The amount field holds integer cents for its
whole life and is only ever rendered through centsToDisplay, so no decimal
string is parsed anywhere.

Invalidates the bare 'Transactions' literal rather than a keyed page: every
page is its own cache entry and TanStack matches by prefix, so keying it would
refresh only whichever page happened to be open."
```

---

### Task 13: The delete confirmation

Destructive actions confirm first. The dialog names the transaction being
deleted, because "Excluir?" over a table of twenty-seven rows does not say which
one.

Unlike the category confirmation, there is no consequence to explain: deleting a
transaction deletes exactly that transaction.

**Files:**
- Create: `apps/frontend/src/features/transactions/DeleteTransactionDialog.tsx`, `DeleteTransactionDialog.test.tsx`

**Interfaces:**
- Consumes: `useDeleteTransactionMutation` (task 9).
- Produces:
  - `interface DeleteTransactionTarget { id: string; description: string }`
  - `DeleteTransactionDialog(props: { transaction: DeleteTransactionTarget | null; onClose: () => void }): JSX.Element | null`

- [x] **Step 1: Write the failing test**

Create `apps/frontend/src/features/transactions/DeleteTransactionDialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, graphqlError, ok } from '@/test/msw/api';
import { DeleteTransactionDialog } from '@/features/transactions/DeleteTransactionDialog';

const target = { id: 'transaction-1', description: 'Aluguel' };

describe('DeleteTransactionDialog', () => {
  it('renders nothing until there is a target', () => {
    renderWithProviders(
      <DeleteTransactionDialog transaction={null} onClose={vi.fn()} />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the transaction it is about to delete', () => {
    renderWithProviders(
      <DeleteTransactionDialog transaction={target} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('Aluguel');
  });

  it('deletes and refetches every affected list', async () => {
    const variables = vi.fn();
    server.use(
      api.mutation('DeleteTransaction', ({ variables: received }) => {
        variables(received);
        return ok({ deleteTransaction: true });
      }),
    );

    const onClose = vi.fn();
    const { queryClient } = renderWithProviders(
      <DeleteTransactionDialog transaction={target} onClose={onClose} />,
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(variables).toHaveBeenCalledWith({ id: 'transaction-1' });

    const keys = invalidate.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey[0],
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'Transactions',
        'Categories',
        'CategoryStats',
        'Summary',
      ]),
    );
  });

  it('leaves the dialog open and says so when the delete fails', async () => {
    server.use(
      api.mutation('DeleteTransaction', () => graphqlError('NOT_FOUND')),
    );

    const onClose = vi.fn();
    renderWithProviders(
      <DeleteTransactionDialog transaction={target} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(
      await screen.findByText('Não foi possível excluir. Tente novamente.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without deleting when cancelled', async () => {
    const called = vi.fn();
    server.use(
      api.mutation('DeleteTransaction', () => {
        called();
        return ok({ deleteTransaction: true });
      }),
    );

    const onClose = vi.fn();
    renderWithProviders(
      <DeleteTransactionDialog transaction={target} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(called).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/transactions/DeleteTransactionDialog.test.tsx"
```

Expected: FAIL — the module does not resolve.

- [x] **Step 3: Write the dialog**

Create `apps/frontend/src/features/transactions/DeleteTransactionDialog.tsx`:

```tsx
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/useToast';
import {
  useCategoriesQuery,
  useCategoryStatsQuery,
  useDeleteTransactionMutation,
} from '@/graphql/generated/graphql';

export interface DeleteTransactionTarget {
  id: string;
  description: string;
}

export interface DeleteTransactionDialogProps {
  transaction: DeleteTransactionTarget | null;
  onClose: () => void;
}

export function DeleteTransactionDialog({
  transaction,
  onClose,
}: DeleteTransactionDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const deleteTransaction = useDeleteTransactionMutation();
  // deleteTransaction.isPending goes false the instant mutateAsync resolves,
  // while the dialog stays open and interactive through the awaited
  // invalidation below. A local flag stays true for the whole handler, so a
  // second click in that window cannot fire a second delete that answers
  // NOT_FOUND for a row already gone.
  const [pending, setPending] = useState(false);

  if (!transaction) return null;

  async function confirm() {
    if (!transaction) return;

    setPending(true);
    try {
      await deleteTransaction.mutateAsync({ id: transaction.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['Transactions'] }),
        queryClient.invalidateQueries({ queryKey: useCategoriesQuery.getKey() }),
        queryClient.invalidateQueries({
          queryKey: useCategoryStatsQuery.getKey(),
        }),
        queryClient.invalidateQueries({ queryKey: ['Summary'] }),
      ]);

      showToast('Transação excluída');
      onClose();
    } catch {
      showToast('Não foi possível excluir. Tente novamente.', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Excluir transação">
      {/* No consequence to spell out, unlike the category confirmation:
          deleting a transaction deletes exactly that transaction. */}
      <p className="text-sm text-gray-600">
        Tem certeza que deseja excluir{' '}
        <strong>{transaction.description}</strong>? Esta ação não pode ser
        desfeita.
      </p>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={confirm}
          loading={pending}
          className="bg-danger hover:bg-red-dark"
        >
          Excluir
        </Button>
      </div>
    </Dialog>
  );
}
```

The failure test asserts on the toast text, so the toast has to render its
message where `findByText` can reach it. It already does — `DeleteCategoryDialog`
is tested the same way.

- [x] **Step 4: Run it to make sure it passes**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/transactions/DeleteTransactionDialog.test.tsx"
rtk proxy "npm run typecheck -w @financy/frontend"
```

Expected: both exit 0.

- [x] **Step 5: Commit**

```bash
git add apps/frontend/src/features/transactions/DeleteTransactionDialog.tsx apps/frontend/src/features/transactions/DeleteTransactionDialog.test.tsx
git commit -m "feat(frontend): confirm before deleting a transaction

Names the transaction, because a bare 'Excluir?' over twenty-seven rows does
not say which one. A local pending flag covers the window between the mutation
resolving and the invalidation finishing, where the dialog is still clickable."
```

---

### Task 14: The transactions page

The screen. A header with the create button, the table, and a footer carrying
the range, the total and the pagination.

Split three ways so each file has one job: the page owns the query and the
dialog state, the table owns the columns and the scroll wrapper, and the row
owns one transaction's presentation. A single file would hold all three and be
the file nobody wants to open.

The page number lives in the URL. It costs the same as `useState` today, and
slice 4's "changing a filter resets to page 1" needs something to reset.

The filter bar is **not** part of this task.

**Files:**
- Create: `apps/frontend/src/features/transactions/TransactionRow.tsx`
- Create: `apps/frontend/src/features/transactions/TransactionsTable.tsx`, `TransactionsTable.test.tsx`
- Create: `apps/frontend/src/features/transactions/TransactionsPage.tsx`, `TransactionsPage.test.tsx`
- Modify: `apps/frontend/src/routes.tsx`, `apps/frontend/src/routes.test.tsx`

**Interfaces:**
- Consumes: `useTransactionsQuery` (task 9); `TransactionDialog` (task 12); `DeleteTransactionDialog` (task 13); `Skeleton`, `PanelError` (task 11); `formatSignedAmount`, `formatShortDate` (task 8); `CategoryBadge`, `Tag`, `TypeIndicator`, `Pagination`, `IconButton` (existing).
- Produces:
  - `interface TransactionRowData { id: string; description: string; amount: number; type: 'INCOME' | 'EXPENSE'; date: string; category: { id: string; name: string; icon: CategoryIcon; color: CategoryColor } | null }`
  - `TransactionsTable(props: { transactions: TransactionRowData[]; onEdit: (t: TransactionRowData) => void; onDelete: (t: TransactionRowData) => void }): JSX.Element`
  - `TransactionsPage(): JSX.Element`
  - `PAGE_SIZE: 10`

- [x] **Step 1: Write the failing tests**

Create `apps/frontend/src/features/transactions/TransactionsTable.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TransactionsTable,
  type TransactionRowData,
} from '@/features/transactions/TransactionsTable';

const rows: TransactionRowData[] = [
  {
    id: 'transaction-1',
    description: 'Aluguel',
    amount: 210_000,
    type: 'EXPENSE',
    date: '2026-08-05T03:00:00.000Z',
    category: {
      id: 'category-1',
      name: 'Moradia',
      icon: 'HOME',
      color: 'BLUE',
    },
  },
  {
    id: 'transaction-2',
    description: 'Freelance de design',
    amount: 120_000,
    type: 'INCOME',
    date: '2026-07-18T03:00:00.000Z',
    category: null,
  },
];

describe('TransactionsTable', () => {
  it('renders the six columns from the design', () => {
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual(['Descrição', 'Data', 'Categoria', 'Tipo', 'Valor', 'Ações']);
  });

  it('renders an expense with a leading minus and income with a plus', () => {
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('-R$ 2.100,00')).toBeInTheDocument();
    expect(screen.getByText('+R$ 1.200,00')).toBeInTheDocument();
  });

  it('renders the date as DD/MM/YY', () => {
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('05/08/26')).toBeInTheDocument();
  });

  it('labels an uncategorized row rather than leaving the cell blank', () => {
    // The design has no state for this; frontend.md section 12 records the
    // neutral tag as the decision.
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Sem categoria')).toBeInTheDocument();
  });

  it('names each row action after its transaction', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TransactionsTable
        transactions={rows}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Aluguel' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir Aluguel' }),
    );

    expect(onEdit).toHaveBeenCalledWith(rows[0]);
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
  });

  it('puts edit before delete in tab order', () => {
    render(
      <TransactionsTable
        transactions={[rows[0]!]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const actions = within(screen.getAllByRole('row')[1]!).getAllByRole(
      'button',
    );

    expect(actions[0]).toHaveAccessibleName('Editar Aluguel');
    expect(actions[1]).toHaveAccessibleName('Excluir Aluguel');
  });
});
```

Create `apps/frontend/src/features/transactions/TransactionsPage.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { api, aUser, graphqlError, ok } from '@/test/msw/api';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';

function aTransaction(index: number) {
  return {
    id: `transaction-${index}`,
    description: `Transação ${index}`,
    amount: 1_000 * index,
    type: 'EXPENSE',
    date: `2026-08-${String(index).padStart(2, '0')}T03:00:00.000Z`,
    category: null,
  };
}

function mockPage(items: unknown[], totalCount: number) {
  server.use(
    api.query('Transactions', () =>
      ok({ transactions: { items, totalCount } }),
    ),
  );
}

beforeEach(() => {
  // MSW is strict, so the shell's own query has to be mocked on every render.
  server.use(api.query('Me', () => ok({ me: aUser })));
  server.use(api.query('Categories', () => ok({ categories: [] })));
});

describe('TransactionsPage', () => {
  it('announces that it is loading before the rows arrive', () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    expect(
      screen.getByRole('status', { name: 'Carregando transações' }),
    ).toBeInTheDocument();
  });

  it('renders the rows it was given', async () => {
    mockPage([aTransaction(1), aTransaction(2)], 2);
    renderWithProviders(<TransactionsPage />);

    expect(await screen.findByText('Transação 1')).toBeInTheDocument();
    expect(screen.getByText('Transação 2')).toBeInTheDocument();
  });

  it('offers the create action when there is nothing yet', async () => {
    mockPage([], 0);
    renderWithProviders(<TransactionsPage />);

    expect(
      await screen.findByText('Nenhuma transação ainda'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar primeira transação' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the query fails', async () => {
    server.use(api.query('Transactions', () => graphqlError('NOT_FOUND')));
    renderWithProviders(<TransactionsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as transações',
    );
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });

  it('reports the range and the total, as the design does', async () => {
    mockPage(
      Array.from({ length: 10 }, (_, index) => aTransaction(index + 1)),
      27,
    );
    renderWithProviders(<TransactionsPage />);

    expect(await screen.findByText('1 a 10 | 27 resultados')).toBeInTheDocument();
  });

  it('reports a partial last page correctly', async () => {
    mockPage(
      Array.from({ length: 7 }, (_, index) => aTransaction(index + 1)),
      27,
    );
    renderWithProviders(<TransactionsPage />, { route: '/transactions?page=3' });

    expect(await screen.findByText('21 a 27 | 27 resultados')).toBeInTheDocument();
  });

  it('asks for the right window when a page is chosen', async () => {
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

    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(screen.getByRole('button', { name: '3' }));

    await waitFor(() =>
      expect(variables).toHaveBeenLastCalledWith({ limit: 10, offset: 20 }),
    );
  });

  it('keeps the page in the URL so the view can be reloaded and shared', async () => {
    mockPage([aTransaction(1)], 27);
    renderWithProviders(<TransactionsPage />, { route: '/transactions?page=2' });

    await screen.findByText('Transação 1');

    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens an empty dialog for a new transaction', async () => {
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova transação' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Nova transação' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveValue('');
  });

  it('opens the dialog holding the row it was asked to edit', async () => {
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Transação 1' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Editar transação' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveValue('Transação 1');
  });

  it('opens a fresh form after an edit was cancelled', async () => {
    // Slice 2's review found the category dialog reopening with the previous
    // values, because it stayed mounted. This is that regression, for the
    // dialog with the same shape.
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Transação 1' }),
    );
    await screen.findByRole('heading', { name: 'Editar transação' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await userEvent.click(
      screen.getByRole('button', { name: '+ Nova transação' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Nova transação' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveValue('');
  });

  it('confirms before deleting', async () => {
    mockPage([aTransaction(1)], 1);
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Transação 1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir Transação 1' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Excluir transação' }),
    ).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run them to make sure they fail**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/transactions/TransactionsTable.test.tsx src/features/transactions/TransactionsPage.test.tsx"
```

Expected: FAIL — neither module resolves.

- [x] **Step 3: Write the row**

Create `apps/frontend/src/features/transactions/TransactionRow.tsx`:

```tsx
import { Pencil, Trash2 } from 'lucide-react';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { IconButton } from '@/components/ui/IconButton';
import { Tag } from '@/components/ui/Tag';
import { TypeIndicator } from '@/components/ui/TypeIndicator';
import { formatSignedAmount } from '@/lib/currency';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { CategoryColor, CategoryIcon } from '@/lib/category-tokens';

export interface TransactionRowData {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  category: {
    id: string;
    name: string;
    icon: CategoryIcon;
    color: CategoryColor;
  } | null;
}

export interface TransactionRowProps {
  transaction: TransactionRowData;
  onEdit: (transaction: TransactionRowData) => void;
  onDelete: (transaction: TransactionRowData) => void;
}

const CELL = 'px-4 py-3 text-sm whitespace-nowrap';

export function TransactionRow({
  transaction,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const { description, amount, type, date, category } = transaction;

  return (
    <tr className="border-t border-gray-200">
      <td className={CELL}>
        <div className="flex items-center gap-3">
          {/* Both fall back to neutral when there is no category — a
              transaction can be created without one and can lose one when its
              category is deleted. frontend.md section 12. */}
          <CategoryBadge icon={category?.icon} color={category?.color} />
          <span className="font-medium text-gray-800">{description}</span>
        </div>
      </td>

      <td className={cn(CELL, 'text-gray-600')}>{formatShortDate(date)}</td>

      <td className={CELL}>
        <Tag color={category?.color}>{category?.name ?? 'Sem categoria'}</Tag>
      </td>

      <td className={CELL}>
        <TypeIndicator type={type} />
      </td>

      <td
        className={cn(
          CELL,
          'font-semibold',
          type === 'INCOME' ? 'text-success' : 'text-danger',
        )}
      >
        {formatSignedAmount(amount, type)}
      </td>

      <td className={CELL}>
        {/* Edit before delete, so tabbing across a row reaches the safe action
            first. */}
        <div className="flex gap-2">
          <IconButton
            icon={Pencil}
            label={`Editar ${description}`}
            onClick={() => onEdit(transaction)}
          />
          <IconButton
            icon={Trash2}
            label={`Excluir ${description}`}
            variant="danger"
            onClick={() => onDelete(transaction)}
          />
        </div>
      </td>
    </tr>
  );
}
```

- [x] **Step 4: Write the table**

Create `apps/frontend/src/features/transactions/TransactionsTable.tsx`:

```tsx
import { TransactionRow, type TransactionRowData } from './TransactionRow';

export type { TransactionRowData };

export interface TransactionsTableProps {
  transactions: TransactionRowData[];
  onEdit: (transaction: TransactionRowData) => void;
  onDelete: (transaction: TransactionRowData) => void;
}

const COLUMNS = [
  'Descrição',
  'Data',
  'Categoria',
  'Tipo',
  'Valor',
  'Ações',
] as const;

/**
 * Six columns is more than a narrow window fits. The wrapper scrolls
 * horizontally rather than the row collapsing into a card: one markup path, one
 * set of tests, and real table semantics at every width. `frontend.md`
 * section 12 records the decision, since the design is desktop-only.
 */
export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  return (
    <div className="overflow-x-auto">
      {/* An arbitrary value, not min-w-3xl: nothing in this codebase uses the
          min-w container scale, and a utility Tailwind does not emit compiles
          to nothing and the table silently stops forcing the scroll. */}
      <table className="w-full min-w-[48rem] border-collapse text-left">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-xs font-semibold tracking-wide text-gray-500 uppercase"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [x] **Step 5: Write the page**

Create `apps/frontend/src/features/transactions/TransactionsPage.tsx`:

```tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { PanelError } from '@/components/ui/PanelError';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageShell } from '@/components/layout/PageShell';
import { useTransactionsQuery } from '@/graphql/generated/graphql';
import {
  TransactionsTable,
  type TransactionRowData,
} from './TransactionsTable';
import {
  TransactionDialog,
  type TransactionFormTarget,
} from './TransactionDialog';
import {
  DeleteTransactionDialog,
  type DeleteTransactionTarget,
} from './DeleteTransactionDialog';

/** Ten rows per page, matching the design. */
export const PAGE_SIZE = 10;

export function TransactionsPage() {
  // In the URL rather than in state: a page can be reloaded, bookmarked and
  // shared, the back button behaves, and slice 4's "changing a filter resets to
  // page 1" has something that already exists to reset.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = Number(searchParams.get('page'));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const [dialogTarget, setDialogTarget] =
    useState<TransactionFormTarget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteTransactionTarget | null>(null);

  const transactions = useTransactionsQuery({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  function goToPage(next: number) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('page', String(next));
      return params;
    });
  }

  function openCreate() {
    setDialogTarget(null);
    setDialogOpen(true);
  }

  function openEdit(transaction: TransactionRowData) {
    setDialogTarget({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      date: transaction.date,
      categoryId: transaction.category?.id ?? null,
    });
    setDialogOpen(true);
  }

  // `result`, not `page`: the page number and the page of data are different
  // things, and reusing the word is how a bug gets written.
  const result = transactions.data?.transactions;
  const totalCount = result?.totalCount ?? 0;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <PageShell
      title="Transações"
      subtitle="Acompanhe suas entradas e saídas"
      action={<Button onClick={openCreate}>+ Nova transação</Button>}
    >
      {transactions.isPending ? (
        <Skeleton
          label="Carregando transações"
          count={5}
          className="h-14"
          containerClassName="flex flex-col gap-2"
        />
      ) : transactions.isError || !result ? (
        <PanelError
          message="Não foi possível carregar as transações"
          onRetry={() => void transactions.refetch()}
        />
      ) : result.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-medium text-gray-800">Nenhuma transação ainda</p>
          <p className="text-sm text-gray-500">
            Registre sua primeira despesa ou receita.
          </p>
          <Button onClick={openCreate}>Criar primeira transação</Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TransactionsTable
            transactions={result.items}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              {first} a {last} | {totalCount} resultados
            </p>
            <Pagination
              page={page}
              pageCount={Math.ceil(totalCount / PAGE_SIZE)}
              onPageChange={goToPage}
            />
          </div>
        </Card>
      )}

      {/* Mounted only while open. A permanently mounted dialog keyed on its
          target reopens holding the previous values — the blocking defect
          slice 2's review found on the categories page. */}
      {dialogOpen && (
        <TransactionDialog
          open
          onClose={() => setDialogOpen(false)}
          transaction={dialogTarget}
        />
      )}

      <DeleteTransactionDialog
        transaction={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </PageShell>
  );
}
```

`result.items` comes from the generated `TransactionsQuery` type, not from
`TransactionRowData` directly. The two are structurally compatible because
`enumsAsTypes` makes the queried `icon`, `color` and `type` the same string
unions the row is typed with. If this assignment ever fails to compile, that
setting is what changed — do not add a cast.

- [x] **Step 6: Route to it**

In `apps/frontend/src/routes.tsx`, import the page and replace the placeholder:

```tsx
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
```

```tsx
          <Route path="/transactions" element={<TransactionsPage />} />
```

The `Placeholder` component stays — the dashboard still uses it until slice 5.
Update the comment above it to name only the slice that is left.

In `routes.test.tsx`, whichever case asserts the `/transactions` placeholder now
asserts the real page's heading. It will need `Me`, `Transactions` and
`Categories` mocked, since MSW is strict.

- [x] **Step 7: Run them to make sure they pass**

```bash
rtk proxy "npm test -w @financy/frontend -- src/features/transactions"
rtk proxy "npm test -w @financy/frontend -- src/routes.test.tsx"
rtk proxy "npm run typecheck -w @financy/frontend"
```

Expected: three exit 0s.

If the pagination test fails because no page buttons render, `totalCount` in
that mock is below `PAGE_SIZE` — `Pagination` returns null at a page count of
one, by design.

- [x] **Step 8: Look at it**

```bash
rtk proxy "npm run db:seed -w @financy/backend"
npm run dev
```

Open `http://localhost:5173`, sign in as the seed user, and visit
`/transactions`. Confirm by eye: twenty-seven rows across three pages, the
footer reading "1 a 10 | 27 resultados", the two uncategorized rows showing the
neutral "Sem categoria" tag, income rows green with a `+` and expenses red with
a `-`, and the window narrowed until the table scrolls sideways rather than the
page doing so.

This step is not a test and does not gate the commit, but the seed exists for
it and nothing else in the plan looks at the screen.

- [x] **Step 9: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(frontend): add the transactions page

The page owns the query and the dialogs, the table owns the columns and the
scroll wrapper, the row owns one transaction — three files rather than one that
does all three.

The page number lives in the URL, so a view can be reloaded and shared, and
slice 4's filter reset has something that already exists to reset.

Six columns do not fit a narrow window: the wrapper scrolls horizontally rather
than the row collapsing into a card, which would mean a second markup path and
every test written twice."
```

---

### Task 15: Slice verification and documentation

The slice is code-complete. This task proves it and writes down what the next
one inherits.

Nothing here is optional. `slice-2-outcome.md` exists because the slice-2 plan
was 190 KB and unreadable as a handover; this slice owes slice 4 the same
document.

**Files:**
- Modify: `docs/specs/backend.md` (§7), `docs/specs/frontend.md` (§12), `docs/plans/roadmap.md`
- Create: `docs/plans/slice-3-figma-handoff.md`, `docs/plans/slice-3-outcome.md`
- Modify: `docs/plans/slice-3-transactions.md` (tick every box)

- [x] **Step 1: Run the whole gate**

```bash
rtk proxy "npm test"
rtk proxy "npm run typecheck"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
rtk proxy "npm run codegen:check -w @financy/backend"
rtk proxy "npm run codegen:check -w @financy/frontend"
```

Expected: six exit 0s. Record the two test counts — they go in the outcome
document, and they are the only evidence there is that the suite passed, since
nothing runs on push.

Every one of these goes through `rtk proxy`. A number from a filtered run is not
verified, and this is the task whose entire output is numbers.

- [x] **Step 2: Audit the definition of done by hand**

Walk `roadmap.md`'s checklist against the diff, not against memory:

```bash
rtk proxy "git diff --stat origin/main"
rtk proxy "grep -rn 'where: {' apps/backend/src/modules/transaction/"
```

Confirm every `where` clause in the transaction module carries `userId`, and
that the cross-user `NOT_FOUND` tests exist for read, update, delete and the
category attachment. If any is missing, it is a defect, not a documentation
gap — fix it before writing anything down.

- [x] **Step 3: Correct the specs**

In `docs/specs/backend.md` §7, replace the pagination line:

```markdown
- pagination — `limit` is an integer of at least 1 and `offset` an integer of at
  least 0; either below its minimum is `BAD_USER_INPUT`. A `limit` above 100 is
  clamped to 100 rather than rejected, since §5 holds the maximum "regardless of
  what the client sends".
```

Update its header line to record the change and the date, matching how slices 1
and 2 did it.

In `docs/specs/frontend.md` §12, add three entries:

```markdown
**The transactions table scrolls horizontally on a narrow screen.** Six columns
do not fit below the medium breakpoint, and the design is desktop-only. The
alternative — collapsing each row into a card — means a second markup path for
the same data, duplicated states, and every table test written twice or gated on
width, all for a layout the design does not draw.

**The page number lives in the URL from slice 3.** §5 puts filter state in the
query string and slice 4 owns the filters, but the page is the same kind of
state and costs nothing to put there early. It also gives "changing a filter
resets to page 1" something that already exists to reset.

**The amount field is a cents-first mask.** §5 says the field displays `R$ 0,00`
and converts to integer cents on submit without saying how. Keystrokes fill from
the right, so the field holds a valid integer at every moment and submit sends
it unchanged — there is no decimal string to parse and no locale ambiguity
between `12,34` and `12.34`.
```

Update its header line the same way.

In `docs/plans/roadmap.md`, move pagination from slice 4 to slice 3 in the
slices table:

| # | Name | Backend | Frontend |
|---|---|---|---|
| 3 | Transactions | `Transaction`, full CRUD, offset pagination, category unlink on delete | Transactions page, table, pagination, transaction dialog, delete confirmation |
| 4 | Search and filters | `TransactionFilter` | Filter bar, URL-backed filter state |

and amend the "What each slice delivers" paragraphs for both to match. Slice 4's
paragraph currently says the page "becomes usable with real volumes of data";
that is now half true of slice 3.

- [x] **Step 4: Write the Figma handoff**

Create `docs/plans/slice-3-figma-handoff.md`, in the format of
`slice-2-figma-handoff.md`. Nothing in it is blocking — the sixteen icon names
are confirmed and this slice builds on nothing unanswered — so it opens by
saying so, then lists what is now built and ready to compare:

- **Transactions page** — the header and its button, the six column headers and
  their order, the row's badge-plus-description cell, the type indicator, the
  amount's color and sign, and the footer's "1 a 10 | 27 resultados" wording.
- **Transaction dialog** — the segmented control's two colors, the date and
  amount fields sitting side by side, and the category select's "Sem categoria"
  option, which the design does not draw.
- **Delete confirmation** — the wording, against the category one.
- **The `/style-guide` primitive comparison**, still carried from slice 0 and
  still unanswered. Say plainly that it has now been open for three slices.

- [x] **Step 5: Write the outcome document**

Create `docs/plans/slice-3-outcome.md`, in the shape of
`slice-2-outcome.md`: what shipped, where the build departed from this plan and
why, the spec corrections, what is open going into slice 4, and the debts slice 4
inherits.

The debts that are already known:

- **`TransactionFilter` is unbuilt**, and the `transactions` query has no
  `filter` argument. Slice 4 adds both, plus the filter bar and the URL state
  for it. The page number is already in the URL.
- **`['Summary']` is invalidated with no consumer**, from the transaction
  dialog and the delete confirmation. Slice 5 has to confirm the generated
  `Summary` query key matches that literal, or both invalidations are silent
  no-ops — the same bet slice 2 made on `['Transactions']`, which task 9 checked
  with a test. Slice 5 should add the matching test.
- **The dashboard is still a placeholder** in `routes.tsx`, and `Placeholder`
  exists only for it.
- **`prisma/seed.ts` has fixed dates in July and August 2026.** The dashboard's
  "current month" figures will read zero whenever the wall clock is outside that
  window. Slice 5 either re-bases the seed on the current month or accepts it.
- **No CI.** Nothing runs the checks on push. Every number in the file came from
  a local run.

Also record anything the build discovered that a reader of this plan could not
infer — that section is the reason the document exists.

- [x] **Step 6: Tick the plan**

Every `- [ ]` in this file becomes `- [x]`. A plan left unticked cannot be told
apart from one that was abandoned halfway. Done: all 115 remaining boxes ticked
in this commit.

- [x] **Step 7: Commit and open the pull request**

```bash
git add docs
git commit -m "docs: correct the specs and record what slice 3 delivered

backend.md section 7 now says which pagination bound rejects and which clamps.
frontend.md section 12 gains the scrolling table, the page in the URL, and the
cents-first mask. roadmap.md moves pagination from slice 4 into slice 3, which
is where it was built and where backend.md section 5 always said it belonged."
```

```bash
git push -u origin feat/slice-3-transactions
gh pr create --title "Slice 3: Transactions" --body "..."
```

The pull request body covers the whole slice, both applications, and states the
test counts from step 1 alongside the note that they come from a local run
because there is no CI.

## Slice completion checklist

Tick these against the diff, not against memory. This is the list the pull
request is reviewed with.

**Both applications**

- [x] Every new behavior has a test, and the tests pass.
- [x] `tsc --noEmit` passes, with no `any` introduced.
- [x] Lint passes. `format:check` passes.
- [x] `codegen:check` reports no diff in either workspace.
- [x] One new environment variable appeared (`SEED_PASSWORD`, Task 7's
      development seed), and it is in the matching `apps/backend/.env.example`.
- [x] No pinned major drifted. `git diff origin/main -- package.json apps/*/package.json`
      shows only `date-fns`, `react`, `react-dom` and the two script changes.
- [x] The specs describe what was built, corrected in this same branch where
      they did not.

**Backend**

- [x] Every new query and mutation filters by the calling user in the where
      clause — including both halves of the paginated list and the loader's
      batch query.
- [x] Cross-user access is covered by a test asserting `NOT_FOUND`, at the
      service layer and through HTTP, for read, update, delete, and attaching to
      another user's category.
- [x] Inputs are validated by zod before reaching Prisma.
- [x] No migration was needed, and none was written.

**Frontend**

- [x] Loading, empty, error and populated states are all implemented on the
      transactions page.
- [x] Deleting a transaction confirms first, naming the transaction.
- [x] The screens are on `slice-3-figma-handoff.md` for comparison, and any
      deviation is in `frontend.md` §12.
- [x] Every interactive element is reachable by keyboard and labelled: each row
      action names its transaction, the skeleton announces through
      `role="status"`, and `PanelError` through `role="alert"`.
- [x] Currency converts correctly in both directions, with the round-trip
      asserted.
- [x] Every transaction mutation invalidates `Transactions`, `Categories`,
      `CategoryStats` and `Summary`.

# Architecture and boundaries findings

**Agent:** architecture
**Baseline:** `main` at `4348600`
**Date:** 2026-08-07

Seven findings, ordered by severity. Six of the ten checklist items turned out to
be non-issues; they are recorded at the bottom with the evidence that closed
them, because "we checked and it is clean" is worth as much as a finding.

Every command below was run as `rtk proxy "<cmd>"` from the repo root.

---

## arch-01 — The category token sets are written out three times by hand and nothing compares them

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - `backend/src/modules/category/validation.ts:8-35` — `CATEGORY_ICONS` (16
    strings) and `CATEGORY_COLORS` (7 strings) as `as const` arrays, fed to
    `z.enum` at `:47-48`. The file's own comment at `:3-7` says this is "the
    only one of the three that runs before a write".
  - `backend/src/modules/category/schema.ts:2-29` — the same 23 strings again,
    as SDL `enum CategoryColor` / `enum CategoryIcon`, in a different order from
    the zod list.
  - `frontend/src/lib/category-tokens.ts:24-40` and `:123-150` — the same 23
    strings a third time, as a hand-written union and a matching `as const`
    array. The generated union already exists at
    `frontend/src/graphql/generated/graphql.ts:8` and `:17` and is not used
    here.
  - `backend/codegen.ts` — `mappers` maps `Category` to `@prisma/client#Category`.
    The Prisma row's `icon` is a plain `String`, so tsc never compares a stored
    value against the SDL enum. Nothing on the backend ties the zod list to the
    SDL list at compile time.
  - command: `rtk proxy "grep -rn 'CATEGORY_ICONS\|CATEGORY_COLORS\|TRANSACTION_TYPES' backend/src backend/tests backend/prisma"`
    → hits only in `modules/category/validation.ts` and
    `modules/transaction/validation.ts`. No test file references either
    constant.
  - `backend/tests/unit/schema-artifact.test.ts:22` — the only schema test
    compares the committed `schema.graphql` against `typeDefs.join('\n')`, i.e.
    SDL against SDL. It cannot see the zod list.
  - `frontend/src/lib/category-tokens.test.ts:25` — the frontend's guard is
    `expect(CATEGORY_ICON_VALUES).toHaveLength(16)`. A swapped or renamed token
    passes it.
- **cost:** Add a seventeenth icon to `category/schema.ts` and forget
  `category/validation.ts`: the published schema advertises the value,
  `createCategory` accepts it through GraphQL parsing, and zod answers
  `BAD_USER_INPUT` with "Selecione um ícone válido" for a token the schema says
  is legal. `npm test`, `npm run typecheck` and `npm run codegen:check` all stay
  green — codegen regenerates `schema.graphql` from the SDL, so the artifact
  agrees with the wrong half. The reverse order (zod first, SDL forgotten) fails
  earlier, at GraphQL parse, but is equally invisible before runtime. On the
  frontend, an *added* token is caught: the generated union widens and stops
  being assignable to `CategoryBadge`'s `icon?: CategoryIcon`
  (`frontend/src/components/ui/CategoryBadge.tsx:11`). A *removed* token is not
  — the narrower generated union stays assignable, `IconPicker` keeps offering
  the dead token (`frontend/src/components/ui/IconPicker.tsx:30`), and the user
  picks it and gets a server rejection.
- **fix:** Backend — interpolate the zod arrays into the SDL template literal in
  `category/schema.ts`, or (smaller) add a unit test that builds the schema and
  asserts `CategoryIcon.getValues()` equals `CATEGORY_ICONS`. Frontend — delete
  the hand-written unions in `lib/category-tokens.ts` and re-export the
  generated `CategoryIcon` / `CategoryColor`, keeping only the class-name and
  label lookups (`Record<CategoryIcon, …>` then fails to compile when the
  generated union changes, which is the check that is missing). Files:
  `backend/src/modules/category/schema.ts`,
  `frontend/src/lib/category-tokens.ts`, one new backend test. Effort: M.

---

## arch-02 — Module boundaries are import boundaries only; the user-scoping rule is re-implemented at six call sites in three directories

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - command: `rtk proxy "grep -rn \"from '../\" backend/src/modules"` → every
    cross-directory import is `../../shared/` or `../../graphql/`. There is not
    one `modules/<a>` → `modules/<b>` import. The boundary looks perfect.
  - It is not, at the data layer. Four files query tables their module does not
    own:
    - `backend/src/modules/category/service.ts:138` and `:139-143` —
      `prisma.transaction.count` and `prisma.transaction.groupBy`.
    - `backend/src/modules/transaction/service.ts:22` —
      `prisma.category.findFirst`, inside `assertCategoryOwned`.
    - `backend/src/modules/summary/service.ts:53` and `:58` —
      `prisma.transaction.groupBy`. The summary module owns no table at all.
    - `backend/src/shared/dataloaders.ts:33` (`prisma.transaction.groupBy`) and
      `:68` (`prisma.category.findMany`).
  - `backend/src/shared/dataloaders.ts:12-15` — `Loaders` exposes
    `categoryTotals` and `categoryById`. These are the read path for
    `Category.transactionCount` and `Category.totalAmount`
    (`backend/src/modules/category/resolvers.ts:31-34`), so `category/service.ts`
    is not the single owner of category reads it appears to be from its
    directory.
- **cost:** The definition of done requires every query to filter by the calling
  user in the where clause. That rule is currently held at six independent
  places, and correctness depends on each author remembering. It does hold today
  — I read all six and each carries `userId`. What it costs is change: adding an
  `archivedAt` column, a soft delete, or a shared-account concept means finding
  every one of them by grep, in three directories, with no accessor to change
  once and no lint rule (see arch-05) to catch a miss. The `summary` module is
  the clearest case — it is a module directory with a service that is entirely a
  second reader of the transaction table, so a change to how transactions are
  scoped has to be applied in a module whose name gives no hint that it reads
  them.
- **fix:** Give the loaders' query bodies to the modules that own the tables —
  `createLoaders` calls `listCategoryTotals(userId, ids)` and
  `findCategoriesByIds(userId, ids)` exported from `category/service.ts`, and
  `assertCategoryOwned` calls `getCategory` instead of its own `findFirst`. That
  leaves `summary/service.ts` as the one deliberate cross-table reader, which is
  worth stating in `backend.md` §3 rather than leaving implied. Files:
  `backend/src/shared/dataloaders.ts`,
  `backend/src/modules/category/service.ts`,
  `backend/src/modules/transaction/service.ts`, `docs/specs/backend.md`.
  Effort: M.

---

## arch-03 — The five error codes are a cross-workspace contract typed on one side and spelled as bare strings on the other

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - `backend/src/shared/errors.ts:4-10` — `ErrorCode` as an `as const` object,
    five values, with the comment "The frontend switches on these."
  - `frontend/src/lib/graphql-errors.ts:4` — `errorCodeOf` is declared
    `(error: unknown) => string | null`. There is no union type for the codes
    anywhere in `frontend/`.
  - Three comparisons against untyped literals:
    - `frontend/src/lib/graphql-client.ts:15` —
      `error.extensions?.code === 'UNAUTHENTICATED'`
    - `frontend/src/features/auth/LoginPage.tsx:39` —
      `errorCodeOf(error) === 'INVALID_CREDENTIALS'`
    - `frontend/src/features/auth/SignUpPage.tsx:35` —
      `errorCodeOf(error) === 'EMAIL_ALREADY_EXISTS'`
  - command: `rtk proxy "grep -rn 'UNAUTHENTICATED\|NOT_FOUND\|BAD_USER_INPUT\|EMAIL_ALREADY_EXISTS\|INVALID_CREDENTIALS' frontend/src"`
    → exit 1 under a filtered pattern; the per-code greps above found the three
    sites plus test fixtures. `NOT_FOUND` and `BAD_USER_INPUT` appear in no
    frontend production file — `BAD_USER_INPUT` is handled structurally via
    `fieldErrorsOf`, `NOT_FOUND` is handled nowhere.
  - The codes are not GraphQL enums, so neither codegen run can carry them
    across the workspace boundary.
- **cost:** A backend rename leaves all three comparisons compiling and silently
  false, with three different user-visible outcomes and no test that fails on
  the frontend side. `UNAUTHENTICATED` is the worst: it is the trigger for
  `notifyUnauthenticated()` (`graphql-client.ts:16`), so an expired token would
  stop redirecting to login and instead leave the user on a screen of failed
  panels — precisely the outcome `docs/specs/frontend.md:325-328` says must not
  happen. `INVALID_CREDENTIALS` would fall back to the generic form-level
  message, and `EMAIL_ALREADY_EXISTS` would stop landing on the email field.
  Separately, `NOT_FOUND` being unhandled means deleting a row a second tab
  already deleted renders "Não foi possível excluir. Tente novamente."
  (`frontend/src/features/categories/DeleteCategoryDialog.tsx:61`) — a retry
  prompt for an operation that can never succeed.
- **fix:** Declare `export type ErrorCode = 'UNAUTHENTICATED' | …` in
  `frontend/src/lib/graphql-errors.ts` and change `errorCodeOf`'s return to
  `ErrorCode | null`. That collapses the frontend's three copies to one and
  makes a typo a compile error. It does **not** close the cross-workspace gap —
  a backend rename still compiles on both sides. Closing that needs either the
  shared package that `5db5bfb` removed, or promoting the codes to an SDL enum
  so codegen emits them. Worth stating the choice explicitly rather than leaving
  it implicit. Files: `frontend/src/lib/graphql-errors.ts` plus the three call
  sites. Effort: S for the frontend-side fix, L for the real one.

---

## arch-04 — Four hand-written cache-invalidation lists with no owner, and `updateCategory` is missing two keys

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `frontend/src/features/transactions/TransactionDialog.tsx:86-103` —
    `Transactions`, `Categories`, `CategoryStats`, `Summary`.
  - `frontend/src/features/transactions/DeleteTransactionDialog.tsx:44-53` — the
    same four.
  - `frontend/src/features/categories/DeleteCategoryDialog.tsx:44-56` —
    `Categories`, `CategoryStats`, `Transactions`. Omitting `Summary` is
    correct: unlinking transactions does not move any money.
  - `frontend/src/features/categories/CategoryDialog.tsx:58-66` — only
    `Categories` and `CategoryStats`. Its comment reads "Both lists carry counts
    that this mutation changed", which accounts for a create but not for a
    rename or a recolor.
  - `docs/specs/frontend.md:314` — the spec's table gives
    `createCategory, updateCategory` → "categories, categoryStats". So the code
    matches the spec; the spec is the side that is wrong. Its own reasoning at
    `:318-320` — a category's rows "must re-render without the category rather
    than showing a tag for something that no longer exists" — applies to a
    renamed category as much as a deleted one.
  - `frontend/src/App.tsx:7-14` — the client sets only `retry` and
    `refetchOnWindowFocus`. `staleTime` is the default 0.
- **cost:** Rename or recolor a category on `/categories`, then open
  `/transactions`: the table paints from cache with the old tag name and colour
  before the mount refetch replaces it. Because `staleTime` is 0 the wrong value
  is a flash, not a permanent state — this is why the severity is low and not
  medium. The structural cost is the larger one: the invalidation contract is
  stated once in a spec table and re-typed at four call sites, and the four have
  already diverged in a way no test notices, because each dialog's test asserts
  its own list rather than a shared one
  (`TransactionDialog.test.tsx:146`, `DeleteTransactionDialog.test.tsx:41`).
- **fix:** One helper in `frontend/src/lib/` — `invalidateAfter(queryClient,
  'category' | 'transaction' | 'profile')` — holding the table from
  `frontend.md` §6, called by all four dialogs. Add `transactions` to the
  category row of the spec table in the same change. Files: one new lib file,
  four dialogs, `docs/specs/frontend.md`. Effort: M.

---

## arch-05 — Nothing mechanically enforces the layering both specs describe

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `docs/specs/backend.md:97-106` — resolvers "contain no business rules and
    never call Prisma directly"; "Prisma is the only thing that touches the
    database".
  - `eslint.config.mjs:25-32` — the only shared rules are `no-undef` off,
    `no-explicit-any`, `no-unused-vars`. No `import/no-restricted-paths`, no
    `no-restricted-imports`, no boundary plugin anywhere in the file.
  - The rules currently hold. Verified, not assumed:
    - command: `rtk proxy "grep -rn 'prisma' backend/src/modules --include=resolvers.ts"`
      → exit 1, no matches. Item 2 of the checklist is clean.
    - command: `rtk proxy "grep -rn \"from '@/\" frontend/src/lib frontend/src/components"`
      → nothing under `frontend/src/lib/` imports from `@/features` or
      `@/components`; the only `@/` imports in `lib/` are test files importing
      their own module. Item 6 is clean.
  - The one inversion that exists is deliberate and spec'd:
    `frontend/src/components/layout/AppLayout.tsx:4`,
    `RequireAuth.tsx:2` and `RequireAnonymous.tsx:2` import
    `@/features/auth/useSession`. `docs/specs/frontend.md:405` puts the guards
    in `layout/`, and `components/ui/` — the design-system layer that
    `frontend.md:432` calls the source of truth — has zero feature imports. The
    inversion is confined to app chrome.
- **cost:** Forward-looking, not present. Four rules that the specs state as
  invariants are held by author discipline in a repo with no CI (`CLAUDE.md`,
  "Two standing constraints"), so the first violation ships and is discovered
  by reading. The concrete one to guard is resolvers reaching for Prisma:
  `backend/src/modules/*/resolvers.ts` already imports from `shared/`, so adding
  `import { prisma } from '../../shared/prisma.js'` is one line and passes every
  gate.
- **fix:** `eslint-plugin-import`'s `no-restricted-paths` with four zones —
  `modules/*/resolvers.ts` may not import `shared/prisma`; `frontend/src/lib`
  may not import `features` or `components`; `frontend/src/components/ui` may
  not import `features`; `modules/<a>` may not import `modules/<b>`. Files:
  `eslint.config.mjs`. Effort: S.

---

## arch-06 — Registering a module is five hand edits in one file, and skipping one of them passes every check

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `backend/src/schema.ts` is the single registration point, which is the good
    news — the answer to "how many files to add a fifth module" is one, plus
    `context.ts` only if the module needs a DataLoader. But within that file
    there are five separate places to touch: imports at `:3-10`, the `typeDefs`
    array at `:24-30`, the `Query` spread at `:39-45`, the `Mutation` spread at
    `:47-51`, and the type-level map at `:53-54`.
  - The `Mutation` spread already omits one module on purpose —
    `summaryResolvers` is absent at `:47-51` because summary has no mutations —
    so an omission there does not read as wrong.
  - `backend/tests/unit/schema-artifact.test.ts:22` compares the committed SDL
    against `typeDefs.join('\n')`. It reads the same array the registration
    uses, so a module whose `typeDefs` are registered but whose resolvers are
    not spread in still passes.
  - No test asserts that every field on `Query` and `Mutation` has a resolver.
- **cost:** A module registered in `typeDefs` but missed in the `Mutation`
  spread produces a schema that advertises the mutation, a committed
  `schema.graphql` that contains it, frontend codegen that generates a typed
  hook for it, and a server that answers "Cannot return null for non-nullable
  field Mutation.x" at request time. `npm test`, `npm run typecheck`,
  `npm run lint` and both `codegen:check` runs stay green. The failure has not
  occurred; the mechanism that would let it occur silently is what is verified
  here.
- **fix:** Either collapse the five edits into one — a
  `const modules = [auth, category, transaction, summary]` array of
  `{ typeDefs, resolvers }` merged by a loop — or add a unit test that walks the
  built schema's `Query` and `Mutation` fields and asserts each has a key in
  `resolvers`. The test is the cheaper of the two and catches the type-level map
  at `:53-54` as well. Files: `backend/src/schema.ts` or one new test.
  Effort: S.

---

## arch-07 — `backend.md` states the summary year bound twice and the two disagree

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `docs/specs/backend.md:432` — "`month` is 1–12 and `year` is 1970–9999".
  - `docs/specs/backend.md:526` — "`month` — integer 1–12; `year` — integer
    1970–2100".
  - `backend/src/modules/summary/validation.ts:9-10` — `MIN_YEAR = 1970`,
    `MAX_YEAR = 9999`, with the message "O ano deve estar entre 1970 e 9999" at
    `:20-21`. The code matches §5, so `:526` in §7 is the wrong side.
  - command: `rtk proxy "grep -n '2100\|9999\|1970' docs/specs/backend.md docs/specs/frontend.md"`
    → only those two spec lines; no frontend spec mentions a year bound.
- **cost:** §7 is not an incidental section — `docs/specs/frontend.md:352-354`
  names it as the list the frontend's zod schemas mirror ("same minimum password
  length, same maximum description lengths"). Anyone adding a client-side period
  picker from §7 caps the year at 2100 and rejects 2101–9999, which the server
  accepts. Latent today: nothing on the frontend reads a year from user input —
  the period comes from `currentPeriod()`
  (`frontend/src/features/dashboard/DashboardPage.tsx:18`). It is also the same
  failure mode as arch-01 one layer up: the same number written twice with
  nothing comparing it.
- **fix:** Change `2100` to `9999` at `docs/specs/backend.md:526`. Recorded, not
  applied — this audit may write only this file. Effort: S.

---

## Checked and clean

These are checklist items that produced no finding. Recorded with evidence so
the next pass does not re-derive them.

**1. Validation duplication (item 1) — the constraints agree on every shared
field.** Compared `backend/src/modules/{auth,category,transaction,summary}/validation.ts`
against `frontend/src/features/{auth,categories,transactions}/validation.ts`:

| Field | Backend | Frontend | Verdict |
|---|---|---|---|
| sign-up `password` | `.min(8)` (`auth/validation.ts:13`) | `.min(8)` (`auth/validation.ts:19`) | agree |
| sign-up `name` | trim, 1–100 (`auth/validation.ts:3-7`) | trim, 1–100 (`auth/validation.ts:13-17`) | agree |
| `email` | `z.email()` + lowercase (`auth/validation.ts:9-11`) | `z.email()`, no lowercase (`auth/validation.ts:4`) | agree; the server normalizes, so the client not doing it changes nothing |
| sign-in `password` | unconstrained (`auth/validation.ts:21`) | `.min(1)` (`auth/validation.ts:8`) | deliberate on both sides, and both files say so in a comment |
| category `name` | trim, 1–50 (`category/validation.ts:40-44`) | trim, 1–50 (`categories/validation.ts:14-18`) | agree |
| category `description` | trim, max 200, nullish (`category/validation.ts:50-53`) | trim, max 200 (`categories/validation.ts:19-22`) | agree |
| transaction `description` | trim, 1–200 (`transaction/validation.ts:16-20`) | trim, 1–200 (`transactions/validation.ts:10-14`) | agree |
| transaction `amount` | `z.int().positive()` (`transaction/validation.ts:26-28`) | `z.int().positive()` (`transactions/validation.ts:21`) | agree |
| filter `search` | `.max(100)` (`transaction/validation.ts:77-82`) | `SEARCH_MAX_LENGTH = 100` (`transactions/useTransactionFilters.ts:16`) | agree |
| profile `name` | trim, 1–100 (`auth/validation.ts:24`) | trim, 1–100 (`profile/ProfilePage.tsx:20-26`) | agree |

No field is stricter on one side than the other, so there is no input the client
accepts and the server rejects. Two notes that are not findings:

- The amount ceiling is handled, not missing. Neither zod schema bounds it
  above, but `frontend/src/lib/currency.ts:41` clamps to
  `MAX_CENTS = 2_147_483_647` and GraphQL's own `Int` coercion rejects anything
  larger before the resolver runs.
- The profile form's schema is inline in
  `frontend/src/features/profile/ProfilePage.tsx:20-26` rather than in a
  `features/profile/validation.ts`, unlike the other three features. It is the
  third hand-copy of the user-`name` rule. Cosmetic; no cost to name.

**2. Resolver/service layering (item 2) — clean.**
`rtk proxy "grep -rn 'prisma' backend/src/modules --include=resolvers.ts"` →
exit 1, no matches. All four resolver files import only
`../../graphql/generated/resolvers.js`, `../../shared/auth-guard.js` and their
own `./service.js`. Every resolver body is a one-line delegation with
`requireUser(context)` as the first argument. `backend.md:97-106` is satisfied
exactly.

**3. Cross-module imports (item 3) — zero.**
`rtk proxy "grep -rn \"from '../\" backend/src/modules"` returns 20 lines, all
`../../shared/` or `../../graphql/`. The data-level version of this coupling is
arch-02.

**5. Frontend feature coupling (item 5) — one import, and it is correct.**
`rtk proxy "grep -rn \"@/features/\" frontend/src"` finds exactly one
feature-to-feature production import:
`frontend/src/features/dashboard/DashboardPage.tsx:10` importing
`TransactionDialog` from `features/transactions/`. I expected this to be the
finding and it is not — `TransactionDialog`'s `invalidate()`
(`TransactionDialog.tsx:86-103`) already invalidates `['Summary']`, with a
comment at `:98-100` saying it was added for the dashboard before the dashboard
existed. Creating a transaction from the dashboard therefore refreshes the stat
cards above it. `features/profile/ProfilePage.tsx:18` importing
`features/auth/useSession` is the auth session context doing its job, not
coupling. `dashboard/CategoriesPanel.tsx` and `RecentTransactionsPanel.tsx`
import nothing from other features — they render their own markup from
`components/ui/` primitives rather than reusing
`categories/CategoryCard.tsx` or `transactions/TransactionRow.tsx`, which is
right: the dashboard rows are a different layout with no edit or delete
affordance.

**6. `lib/` direction (item 6) — clean.** Covered in arch-05's evidence. Nothing
under `frontend/src/lib/` imports from `features/` or `components/`.

**9. File size (item 9) — two production files over 250 lines, neither a
problem.** From `rtk proxy "find … -exec wc -l {} +"`:

- `frontend/src/pages/StyleGuide.tsx` (304) — 18 `<Section>` blocks, one per
  primitive. One responsibility (render the gallery), just long. Splitting it
  would spread the gallery across files for no gain.
- `frontend/src/features/transactions/TransactionDialog.tsx` (266) — form
  schema wiring, the cents mask `Controller`, the async category `<Select>`
  placeholder logic (`:157-162`), and the invalidation list. The invalidation
  list is the one piece that belongs elsewhere, and that is arch-04.

Everything else is under 250. The five files above 250 are all `.test.tsx`
(`TransactionsPage.test.tsx` 560, `CategoriesPage.test.tsx` 440,
`useTransactionFilters.test.tsx` 312, `TransactionDialog.test.tsx` 275,
`DashboardPage.test.tsx` 272), which is table-driven test length, not a
structural problem.

**10. Spec drift (item 10) — one contradiction, recorded as arch-07.** Also
checked and found accurate: `backend.md:111-136`'s directory tree matches the
repo exactly; `backend.md:97-106`'s three layers hold (item 2);
`frontend.md:400-426`'s tree matches, including `graphql/operations/` sitting at
the top level rather than inside each feature — that reads against
`frontend.md:428`'s "organized by feature, not by file type", but the structure
block is explicit about it, so it is a documented choice rather than drift.
`frontend.md` §12 was read and its entries excluded from consideration
throughout.

**8. Shared code (item 8) — what is genuinely duplicated across the workspace
boundary.** There is no shared package (`5db5bfb` dropped the empty
`packages/`), and each workspace runs its own codegen against the committed
`backend/schema.graphql`. That artifact carries most of what would otherwise
drift — every type, input and enum reachable from an operation arrives on the
frontend generated, and `codegen:check` fails if it goes stale. What it does
**not** carry, and what is therefore maintained by hand today:

| Duplicated thing | Copies | Aligned by | Finding |
|---|---|---|---|
| Category icon/color token sets | 3 hand-written (+2 generated) | comments and hope | arch-01 |
| Error codes | 2 (typed backend, literals frontend) | comment at `errors.ts:3` | arch-03 |
| Validation constants (8, 50, 100, 200) | 2 per field | comments citing `backend.md` §7 | none — they agree today |
| Cache-invalidation key map | 1 spec table, 4 implementations | nothing | arch-04 |

The cost of keeping these aligned by hand is one grep per change, and it is
already unpaid twice: `docs/specs/backend.md` disagrees with itself on the year
bound (arch-07) and `CategoryDialog` disagrees with its three siblings on
invalidation (arch-04). Restoring a shared package is not the cheapest answer
for any of the four — arch-01 and arch-06 are fixed by generating from one
source inside a single workspace, arch-04 is purely frontend-local, and only
arch-03 genuinely wants a shared module. A `packages/contracts` holding five
string constants is not worth a workspace; promoting the error codes to a
GraphQL enum gets the same result through machinery that already exists.

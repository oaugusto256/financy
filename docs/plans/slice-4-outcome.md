# Slice 4 — outcome

Status: code-complete on `feat/slice-4-search-and-filters`. Not yet merged.

What [`slice-4-search-and-filters.md`](./slice-4-search-and-filters.md) planned
and what actually landed, so slice 5 starts from the built state rather than
from the plan. The plan file keeps its own step checkboxes; this file records
what a reader of that plan could not infer.

## What shipped

**Backend.** A `TransactionFilterArgs` zod schema (`search` capped at 100
characters, `type`, `categoryId`, `dateFrom`/`dateTo`, all optional) validated
before it reaches Prisma. The filter builds one `Prisma.TransactionWhereInput`,
combined with AND, and that same where clause is handed to both `findMany` and
`count` inside the existing `prisma.$transaction` — filtering one half and not
the other would report a count for a set the page does not come from.
Description search uses Prisma `contains` with no `mode` (the SQLite generator
emits no `QueryMode`), so it is case-insensitive only because SQLite's `LIKE`
already is. `TransactionFilter` is now on the SDL, as an optional argument to
the `transactions` query, and codegen carries it through to both workspaces.

**Frontend.** `lib/period.ts` builds the thirteen-option period list — "Todos
os períodos" plus the current month and the eleven before it — and derives a
month's inclusive local start/end from a canonical `yyyy-MM` value.
`useTransactionFilters` keeps `q`, `type`, `category` and `period` in the URL
query string, debounces the search write at 300ms with `replace: true`, and
deletes (rather than sets) the `page` param when any filter changes.
`TransactionFilters` is the four-control bar — search with a leading icon,
type select, category select (fed by the existing `Categories` query, now
unconditional on this page), period select — rendered always-mounted above the
loading/empty/error/populated switch. `TransactionsPage` spreads the built
filter into the `transactions` query variables, and the filtered-empty state
gained its own copy and a "Limpar filtros" button distinct from the unfiltered
empty state's "Criar primeira transação".

**Verification at the end of this slice**, all through `rtk proxy`:

- `npm test -w @financy/backend` — 249 tests, 23 files, all passing.
- `npm test -w @financy/frontend` — 289 tests, 48 files, all passing.
- `npm run typecheck` — exit 0, both workspaces, no `any` introduced.
- `npm run lint` — exit 0.
- `npm run format:check` — exit 0, "All matched files use Prettier code
  style!".
- `npm run codegen:check -w @financy/backend` — exit 0, no diff.
- `npm run codegen:check -w @financy/frontend` — exit 0, no diff.
- `git diff package.json apps/backend/package.json apps/frontend/package.json`
  — empty. No task in this slice installed anything.

Run per workspace, per `slice-3-outcome.md`'s note: a single `npm test` run of
both suites on a loaded machine can fail frontend files on vitest
worker-startup timeouts, which is resource contention and not a test failure.

## Where the build departed from the plan

| Departure | Why |
|---|---|
| The plan's filter-spread rationale (`TransactionsPage.tsx`) was factually false | The plan's comment claimed spreading the filter conditionally (`...(filters.filter && { filter: filters.filter })`) avoids a cache miss, on the premise that an explicit `filter: undefined` is still a key with a `filter` property. It is not: TanStack Query v5's default `hashKey` uses `JSON.stringify`, which drops `undefined`-valued properties, so `{ limit, offset, filter: undefined }` and `{ limit, offset }` hash identically — the spread never changed which cache entry a request lands on. The owner ruled: keep the spread (it still keeps the query key itself free of a spurious `undefined` property — readable in devtools, and safe if a custom `queryKeyHashFn` is ever configured), correct the comment. `913b259` did that. `backend.md` and `frontend.md` do not repeat the false claim — grepped, nothing to fix — so this correction lives only here. |
| Task 5's two `getKey` tests could not fail at the vitest layer | The plan's prescribed tests for the `TypedDocumentString` change exercised `getKey`, which is a generic pass-through untouched by adding `$filter` to the operation — the tests would pass identically against the pre-Task-5 generated code. Compounding it: vitest in this repo runs on an esbuild transform with no type-checking, so a type-only regression (e.g. dropping `$filter` from the document while `getKey` stays correct) is invisible to `npm test`; the real RED for a codegen-shaped change is `npm run typecheck`. The owner ruled: keep both prescribed tests as written and add a third that reads the generated `TypedDocumentString` directly and asserts it declares and forwards `$filter` (`85bcda1`). This is the second slice in a row this has come up — `slice-3-outcome.md`'s Task 5 area carried a related note — and the plan's Step 2 prediction that these tests would catch a regression was wrong for at least Tasks 5 and 8. |
| `codegen:check` must run after `git add`, not before | `codegen:check` diffs the regenerated tree against the git *index* (`git diff --exit-code`), not the working tree. On any task that changes the schema or an operation, running it before staging always reports a diff even when the generated output is correct and unchanged from what's about to be committed. `slice-3-outcome.md` already carried this as a deferred minor (`codegen:check` being "unstaged-only"); this slice hit the same thing operationally on Task 3 and recorded it in the ledger as a note for every subsequent schema-touching task. Not fixed — it's a roadmap-level tooling change, out of scope here. |
| Task 6's URL→draft sync could not use a `useEffect` as the plan's Step 3 sketched | `eslint-plugin-react-hooks@7` flags a `setState` call inside a `useEffect` whose only job is mirroring a prop/derived value into state as a set-state-in-effect violation. Implemented with React's adjust-state-during-render pattern (comparing against a ref and calling `setState` directly in the render body) instead. Reviewer confirmed it is correct and equivalent to what the plan asked for; no second commit needed. |
| Task 6's back-navigation test needed a different router harness | The plan's prescribed test called `history.back()` under `MemoryRouter`, which does not drive that router — `MemoryRouter` has no `history` object to intercept. Rebuilt on a router setup where back-navigation actually exercises the hook, and strengthened to assert the hook's own `filter` output rather than only DOM state. Pre-flight-noted in the ledger before the task started, so this was anticipated, not a surprise mid-build. |
| Task 3's brief snippet used `signToken(user.id)` directly | That hands an unawaited `Promise` to the `Authorization` header. The implementer used the file's existing `signedIn()` fixture instead. Reviewer confirmed this is a correction, not scope creep. |
| Task 4's `periodRange` initially accepted an un-padded month (`'2026-8'`) | Flagged as a deferred minor when Task 4 shipped. Closed two tasks later without reopening Task 4: Task 6's second review round required `periodRange` to reject anything not shaped `/^\d{4}-\d{2}$/`, which incidentally closed this gap alongside the select-desync bug that round was actually about (`0736fa2`). |
| Task 8 had no recoverable RED-before-implementation evidence | The original implementer's session died to connection errors after committing `183397e`. A verifier re-ran the full suite, the gate, and the three mutation checks the plan prescribed against the already-committed code, and wrote `task-8-report.md` rather than reconstructing a RED phase that no longer existed to observe. Recorded here because it's a gap in this slice's TDD evidence, not because the shipped code is in question — the review that followed was clean. |

## Spec corrections made in this slice

- `backend.md` header and §2 (the "SQLite constraint" subsection, where the
  existing accent-folding limit already lived — the plan and this task's brief
  both call it "§4," but the note it sits beside is in §2; placed next to the
  actual text rather than at the literal section number): `%` and `_` inside a
  search term are unescaped `LIKE` wildcards, because Prisma's `contains` emits
  no `ESCAPE` clause and escaping them means dropping to `prisma.$queryRaw`.
- `backend.md` §5, under the pagination paragraphs: every `TransactionFilter`
  field is optional and combines with AND; `dateFrom`/`dateTo` are inclusive at
  both ends; a `categoryId` belonging to another user returns an empty page
  rather than `NOT_FOUND`, because `userId` is already in the same `where`
  clause and `NOT_FOUND` would confirm the id exists.
- `backend.md` §7, in the validation list: in a `TransactionFilter`, an empty
  string and `null` both mean "no filter on that field" — unlike `categoryId`
  in `UpdateTransactionInput`, where an empty string means "clear it".
- `frontend.md` §5: the period select offers thirteen options — "Todos os
  períodos," then the current month and the eleven before it — with the first
  as the default. The previous text named twelve with no stated default.
- `frontend.md` §12, two new entries: the period select's thirteenth option
  and the owner's ruling for the "all" default (defaulting to the current
  month would land a user with older rows on the filtered-empty state on a
  first visit and silently stop `/transactions` from being a full ledger); and
  filter state's short URL parameter names (`q`, `type`, `category`, `period`),
  the search write's `replace: true`, and that changing a filter deletes
  `page` rather than setting it to `1`.

## Open going into slice 5

- **`['Summary']` is still invalidated with no consumer**, from both the
  transaction dialog and the delete confirmation — carried unchanged from
  `slice-3-outcome.md`; this slice did not touch either file beyond what Task 8
  needed for the filter. Slice 5 must confirm the generated `Summary` query key
  matches that literal, or both invalidations are silent no-ops.
- **The dashboard is still a placeholder** in `routes.tsx`. Unchanged.
- **`prisma/seed.ts` has fixed dates in July and August 2026.** Unchanged;
  slice 5's "current month" figures will read zero outside that window unless
  the seed is re-based.
- **`codegen:check` is unstaged-only** (`git diff --exit-code` against the
  index, not the working tree) — a roadmap-level fix, not scoped to any one
  slice. This slice hit the operational consequence directly; see "Where the
  build departed from the plan" above.
- **The `/style-guide` primitive comparison** is still unanswered, now open
  across four slices with no visual regression yet reported against it.
- **`slice-4-figma-handoff.md`'s "What is now built and ready to compare"
  section** — the filter bar's four controls, its placement, the responsive
  layout, the period option labels, and the filtered-empty state's copy and
  button, all built and ready for the owner to check against Figma.
- **No CI.** Nothing runs the checks on push. Every number in this file came
  from a local run, through `rtk proxy`.

## Deferred minors, from this slice's ledger

Reviewed and deliberately shipped as-is; none reached this task as unresolved
code:

- `validation.ts`'s `dateBound` comment credits the union+pipe guard with
  rejecting `null`; `.nullish()` is what actually does that, the union guards
  non-date-shaped values like `42`. Comment accuracy only (Task 1).
- Two pre-existing filter tests ("filters by category," "filters by an
  inclusive date range") assert on the returned descriptions only, not
  `totalCount` (Task 2).
- The categories-load failure in the filter bar's category select uses
  `helperText` rather than the `error` prop, so it renders in the neutral
  helper style with no `aria-invalid` where `error` would read as a failure.
  The brief prescribed `helperText`; left for the owner's call at merge
  (Task 7).

Three carry-overs the plan named from `slice-3-outcome.md`'s list, folded into
this slice's own tasks and closed here (not deferred further):

- No test that the transaction schemas trim whitespace — closed by Task 1
  (`'trims the description and keeps a real categoryId untouched'` and
  siblings in `transaction-validation.test.ts`).
- A mutation's `['Transactions']` invalidation was only tested against an
  unfiltered list — closed by Task 8
  (`'refetches a filtered list after a delete'` in `TransactionsPage.test.tsx`,
  asserting prefix matching still finds the key once it carries a filter
  object).
- The categories query's `isError` was never read anywhere — closed by Task 7;
  the filter bar's category select now gets the error state the transaction
  dialog still lacks (that gap in the dialog itself remains open, unchanged).

Everything else on `slice-3-outcome.md`'s deferred-minors list, in files this
slice did not open, carries forward unchanged to slice 5 per the plan's
"Carry-overs folded into this slice" ruling (only items in files this slice
already opens were in scope here).

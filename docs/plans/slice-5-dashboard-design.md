# Slice 5 — Dashboard — design

The design agreed before any code was written. It resolves the questions
[`backend.md`](../specs/backend.md) and [`frontend.md`](../specs/frontend.md)
leave open for this slice, and records the decisions the implementation plan
(`slice-5-dashboard.md`) will be built from.

The specs remain the source of truth for behavior. Where this document decides
something the specs do not state, the spec text is corrected in the same pull
request — the correction is listed in [Spec corrections](#spec-corrections-this-slice-owes).

Branch: `feat/slice-5-dashboard`, from `main` at `af70069`.

## 1. What this slice actually contains

The roadmap's slice-5 row reads:

> | 5 | Dashboard | `summary`, `categoryStats`, per-category aggregates, DataLoader | Dashboard stat cards and panels |

Three of those four backend items already shipped:

| Item | Where it landed |
|---|---|
| `categoryStats` | Slice 2 — `schema.graphql:84`, `modules/category/` |
| `Category.transactionCount` / `totalAmount` | Slice 2 — `schema.graphql`, `shared/dataloaders.ts` |
| DataLoaders (`categoryTotals`, `categoryById`) | Slices 2 and 3 — `shared/dataloaders.ts` |

**Slice 5's backend is one query: `summary(month: Int!, year: Int!): Summary!`.**
Everything else in the slice is the dashboard screen, plus the seed re-base in
section 4. `roadmap.md`'s slice-5 row is corrected in this PR to say so.

## 2. Backend — `summary`

### Module

A new `apps/backend/src/modules/summary/`, with the four files every module has:
`schema.ts`, `resolvers.ts`, `service.ts`, `validation.ts`.

It aggregates transactions, so folding it into `modules/transaction/` was the
alternative. It is not folded in: `summary` owns its own GraphQL type, its own
argument validation and its own two aggregate queries, none of which any
transaction resolver touches, and `transaction/service.ts` is already the
largest service in the codebase. A module per root type keeps the boundary where
the SDL already draws it.

`src/schema.ts` gains `summaryTypeDefs` in the `typeDefs` array and
`...(summaryResolvers.Query ?? {})` in `Query`, following the pattern the three
existing modules use.

### SDL

`Summary` moves out of the spec's monolithic SDL listing and into the new
module's tagged template literal, unchanged:

```graphql
type Summary {
  totalBalance: Int!
  monthIncome: Int!
  monthExpense: Int!
}

extend type Query {
  summary(month: Int!, year: Int!): Summary!
}
```

### The month window is UTC

`backend.md` §5 says `monthIncome` and `monthExpense` cover "the requested
calendar month only, from the first instant of day 1 to the last instant of the
final day" without saying in which timezone. The backend has no timezone concept
today: slice 4's `dateFrom`/`dateTo` take absolute instants that the frontend
computed from the browser's local time, so nothing established a precedent.

**Decision: the server builds the window in UTC.**

```
start = new Date(Date.UTC(year, month - 1, 1))
end   = new Date(Date.UTC(year, month, 1))     // exclusive
where: { date: { gte: start, lt: end } }
```

Half-open internally, which is what makes "the last instant of the final day"
exact without picking a millisecond; the spec's inclusive wording still
describes the result. `Date.UTC(year, 12, 1)` rolls into January of the
following year on its own, so December needs no special case.

Chosen over server-local time because a local window makes every test depend on
the `TZ` the suite happens to run under, and makes the same data produce
different figures on a developer's machine and a deployed one. Chosen over
adding `dateFrom`/`dateTo` arguments — which would be the most correct per user
— because that contradicts the `summary(month, year)` signature the spec and the
frontend's stat cards are both written against, for an app with one user in one
timezone.

The cost is real and is recorded as a deviation: a user at UTC-3 who records a
transaction at 31 August 21:00 local time stores 1 September 00:00 UTC, and sees
it counted in September's figures. `frontend.md` §12 gets this entry.

### Aggregates

Two `groupBy` calls, both scoped by `userId` in the `where` clause:

- **All-time**, for `totalBalance`: `groupBy({ by: ['type'], where: { userId },
  _sum: { amount: true } })`. `totalBalance` is `INCOME` sum minus `EXPENSE`
  sum, each defaulting to `0` when the group is absent.
- **The month**, for `monthIncome` and `monthExpense`: the same call with
  `date: { gte: start, lt: end }` added. `monthIncome` is the `INCOME` group's
  sum, `monthExpense` the `EXPENSE` group's, each defaulting to `0`.

`monthExpense` is returned unsigned — a positive number of cents spent, matching
`Category.totalAmount`'s existing unsigned convention. The dashboard card renders
the minus sign.

No DataLoader. `summary` is a single root field resolved once per request, not a
per-row field; there is no N+1 to batch. The two `groupBy` calls run inside one
`prisma.$transaction`, so all three figures come from one consistent read.

### Validation

`validation.ts` exports a `summaryArgs` zod schema, parsed through the existing
`parseInput` helper in `shared/validation.ts` before anything reaches Prisma:

- `month`: integer, 1–12 inclusive.
- `year`: integer, 1970–9999 inclusive. The lower bound is the epoch; the upper
  keeps `Date.UTC` inside the range a four-digit year can round-trip through the
  `DateTime` scalar. Both bounds exist to stop a nonsense year reaching a
  `groupBy` that would scan and return zeros, which reads as "no data" rather
  than as the input error it is.

Anything outside those ranges is `BAD_USER_INPUT` with the failing field named,
which is what `parseInput` already produces. zod 4 rules apply: every message set
positionally or through `.min`/`.max`, never `required_error`.

### No migration

`summary` reads existing columns. Nothing in `schema.prisma` changes.

### Tests

`tests/integration/summary.test.ts`, plus `tests/unit/summary-validation.test.ts`
for the schema in isolation.

Integration, in the shape the roadmap's testing strategy prescribes:

- Success: a user with income and expense in the requested month and in other
  months gets the right three figures.
- A month with no transactions returns `{ 0, 0, 0 }` — not `null`, not an error.
- `totalBalance` spans months: transactions outside the requested month still
  count toward it, and do not count toward `monthIncome`/`monthExpense`.
- December (`month: 12`) does not leak January of the following year, and
  January does not leak the previous December — the two boundaries the rollover
  arithmetic can get wrong.
- Each validation failure: `month: 0`, `month: 13`, a non-integer month, a year
  below 1970, a year above 9999.
- Unauthenticated: `UNAUTHENTICATED`.
- Cross-user: a second user's transactions in the same month do not appear in
  the caller's figures. Asserted as the caller's own figures being unchanged,
  **not** as `NOT_FOUND` — `summary` takes no id, so there is nothing to miss.
  This is the same reasoning slice 4 recorded for a foreign `categoryId` in a
  filter.

Unit, on `summaryArgs`: each bound accepted at its edge and rejected one past it.

## 3. Frontend — the dashboard screen

### Files

A new `src/features/dashboard/`:

| File | What |
|---|---|
| `DashboardPage.tsx` | The screen: the three stat cards and the two-panel row. Owns the `Summary` query. |
| `RecentTransactionsPanel.tsx` | "Transações recentes". Owns its `Transactions` query and its own states. |
| `CategoriesPanel.tsx` | "Categorias". Owns its `Categories` query, the sort and the cap. |

`routes.tsx` replaces `<Placeholder title="Dashboard" />` at line 38 with
`<DashboardPage />`.

A new `src/graphql/operations/summary.graphql` holding one operation:

```graphql
query Summary($month: Int!, $year: Int!) {
  summary(month: $month, year: $year) {
    totalBalance
    monthIncome
    monthExpense
  }
}
```

Both workspaces' codegen runs, and `codegen:check` must report no diff **after
`git add`** — it diffs against the index, not the working tree
(`slice-4-outcome.md`).

### Data sources

Three, of which only one is new:

| Section | Query | Variables |
|---|---|---|
| Stat cards | `Summary` (new) | current month and year, from the client clock |
| Transações recentes | `Transactions` (exists) | `{ limit: 5, offset: 0 }`, no filter |
| Categorias | `Categories` (exists) | none |

The recent-transactions panel reuses the paginated `Transactions` query rather
than adding a `recentTransactions` field. Its default ordering is already
`date DESC, createdAt DESC`, which is exactly "the five most recent", and a
second field returning the same rows in the same order is a second thing to keep
correct.

The categories panel sorts by `totalAmount` descending and slices to five on the
client. `categories` returns a plain unpaginated list precisely because it is
small (`backend.md` §5), so the sort costs nothing and no new argument is needed.

**The month the cards ask for comes from the browser clock, in local time**
(`new Date().getMonth() + 1`, `getFullYear()`), while the server windows that
month in UTC. On the last day of a month in a negative-offset timezone these
disagree for a few hours. That is the deviation §2 already records; it is stated
here too because this is where the two halves meet.

### Query keys and invalidation

Codegen produces `['<OperationName>']` / `['<OperationName>', variables]`
(`graphql.ts:231`, `352`, `388`, `500`). The new operation is named `Summary`,
so its key is `['Summary', { month, year }]`.

`TransactionDialog.tsx:101` and `DeleteTransactionDialog.tsx:52` already call
`invalidateQueries({ queryKey: ['Summary'] })`, which slices 3 and 4 both
recorded as an invalidation with no consumer. Naming the operation `Summary`
makes those two calls start working by prefix match. **No change to either
file** — but the slice owes a test proving the refetch actually happens, because
until now nothing could have caught the key being wrong.

The three sections' keys are `['Summary', …]`, `['Transactions', …]` and
`['Categories']`, all three of which the transaction mutations already
invalidate per `frontend.md` §6. Creating a transaction from the dashboard's
footer button therefore refreshes all three sections.

### States

Every section owns its own loading, empty and error state. A failure in one does
not blank the others.

| State | Stat cards | Transações recentes | Categorias |
|---|---|---|---|
| Loading | `Skeleton` in place of each of the three values | `Skeleton` rows | `Skeleton` rows |
| Error | `PanelError` replacing the card row | `PanelError` replacing the panel body | `PanelError` replacing the panel body |
| Empty | `R$ 0,00` on all three — real data, not a special case | "Nenhuma transação ainda" plus the panel's existing "+ Nova transação" footer button | "Nenhuma categoria ainda" plus the panel's existing "Gerenciar" link |
| Populated | Three `StatCard`s | Five rows | Up to five rows |

`PanelError` already takes `{ message, onRetry }` and renders `role="alert"`
with a "Tentar novamente" button; `onRetry` is the section's own `refetch`.

The empty stat cards are deliberately not a distinct branch. A new user's
balance genuinely is zero, and a "no data yet" card would have to be
distinguished from a real zero balance, which the data cannot do.

A whole-page onboarding state for a user with no transactions *and* no
categories was considered and rejected: it is a second markup path for the same
screen, with its own states and its own tests, and it is not in the design.

### Composition

No new primitives are expected. The screen assembles what exists:

- `StatCard` (`{ icon, label, value, iconClassName }`) for the three cards, with
  `lucide-react` icons and `centsToDisplay` from `lib/currency.ts` for the
  value. `centsToDisplay` already renders a negative `totalBalance` with its
  minus sign. "Despesas do mês" renders through
  `formatSignedAmount(monthExpense, 'EXPENSE')`, which is where the sign the
  unsigned figure does not carry comes from.
- `Card` for both panels.
- Rows in "Transações recentes" reuse what `TransactionRow.tsx` already renders
  — `CategoryBadge`, the description, the date through `lib/format.ts`, the
  category `Tag` (or the neutral "Sem categoria" tag), and `TypeIndicator` with
  the signed amount. Shared markup is extracted only if it comes out identical;
  a near-copy with a `variant` prop is worse than two small components.
- Rows in "Categorias" reuse `CategoryBadge`, `Tag` and `centsToDisplay`.
- `TextLink` for "Ver todas" and "Gerenciar"; `Button` for the footer action.

If a primitive does turn out to be missing, it lands in `components/ui/` with
its own test and its own `/style-guide` entry, per the standing rule that the
design system stays the source of truth.

The category tag on a recent-transaction row is the **category** tag, never a
type tag — `frontend.md` §12 already records that deviation from the design.

Tailwind classes are spelled out and composed with `cn()`. No class name is
built at runtime.

### Accessibility

Each panel is a `<section>` with an accessible name from its heading. The
five-row lists are lists. "Ver todas" and "Gerenciar" are links, "+ Nova
transação" is a button, and every one of them is reachable by keyboard. Skeleton
placeholders are `aria-hidden`, and the panel exposes a busy state rather than
announcing empty skeleton rows.

### Tests

`DashboardPage.test.tsx`, `RecentTransactionsPanel.test.tsx`,
`CategoriesPanel.test.tsx`, driven through MSW at the network boundary
(`onUnhandledRequest: 'error'`).

Per section: populated, empty, error-with-working-retry, and loading. Plus:

- The stat cards request the **current** month and year, and render the three
  figures as Brazilian currency, including a negative `totalBalance`.
- The recent panel requests `limit: 5` and renders an uncategorized row's
  "Sem categoria" tag.
- The categories panel sorts by `totalAmount` descending and caps at five —
  asserted with six categories supplied out of order, so both the sort and the
  cap can fail independently.
- Creating a transaction from the footer button refetches **all three**
  sections. This is the test that proves the `['Summary']` invalidation works;
  it is the one test in this slice that must be seen to fail first.
- "Ver todas" navigates to `/transactions`, "Gerenciar" to `/categories`.

## 4. The seed

`prisma/seed.ts` has fixed dates in July and August 2026. The dashboard's three
stat cards read the current month, so from September 2026 onward a freshly
seeded database shows a dashboard of zeros — the screen looks broken while being
correct.

**The seed is re-based to relative dates**: transactions are spread across the
current month and the eleven before it, computed from the run time. The fixed
RNG seed stays, so descriptions, amounts, types and category assignments remain
reproducible; only the dates move. Twelve months also gives slice 4's period
select something to select in every one of its options, which the fixed dates
never did.

## 5. Spec corrections this slice owes

Per the definition of done, these land in the same PR:

- **`roadmap.md`**, slice-5 backend column: `categoryStats`, the per-category
  aggregates and the DataLoaders shipped in slices 2 and 3. Slice 5's backend is
  `summary`.
- **`backend.md` §5**, in the aggregate-semantics list: the month window is
  built in UTC, half-open internally; `month` is 1–12 and `year` 1970–9999, both
  `BAD_USER_INPUT` outside those ranges; `monthExpense` is unsigned.
- **`frontend.md` §5**, the Dashboard section: the loading, empty and error
  states, stated per section, and the fact that the recent panel reuses the
  paginated `transactions` query rather than a dedicated field.
- **`frontend.md` §12**, one new entry: the summary month window is UTC while
  the dashboard asks for the browser's local current month, so a transaction
  recorded late on the last day of a month in a negative-offset timezone counts
  toward the following month.

## 6. Out of scope

- The carried-forward deferred minors from `slice-3-outcome.md` and
  `slice-4-outcome.md`, in files this slice does not open. The rule from slice 4
  holds: an item is in scope only if this slice already opens its file. The
  transaction dialog's missing `isError` on its categories query stays open.
- **`codegen:check` being unstaged-only.** A roadmap-level tooling change, open
  since slice 3. This slice works around it by staging first, as slice 4 did.
- **The `/style-guide` primitive comparison**, unanswered across four slices.
  Carried, not chased — it has never gated anything. If slice 5 does add a
  primitive, that primitive's own Figma check goes on
  `slice-5-figma-handoff.md`, which is a different question.
- **No CI.** Nothing runs the checks on push. Every claim about a green suite in
  this slice comes from a local run through `rtk proxy`.

## 7. Definition of done, slice 5

The roadmap's checklist, with this slice's specifics:

- `summary` filters by the calling user in the `where` clause of both `groupBy`
  calls, with a cross-user test.
- `summaryArgs` validates `month` and `year` through zod before Prisma.
- No migration — no schema change.
- Loading, empty and error states exist for all three dashboard sections.
- No destructive action is added by this slice.
- `npm test` per workspace, `typecheck`, `lint`, `format:check`, and
  `codegen:check` for both workspaces, all run through `rtk proxy` and all
  green, with the numbers recorded in `slice-5-outcome.md`.
- `git diff package.json apps/*/package.json` is empty, or the drift is
  deliberate and explained. The pinned majors (`prisma`/`@prisma/client` ^6,
  `@apollo/server` ^4, `express` ^4) do not move.

# Slice 5 — outcome

Status: code-complete on `feat/slice-5-dashboard`. Not yet merged.

What [`slice-5-dashboard.md`](./slice-5-dashboard.md) planned and what actually
landed, so slice 6 starts from the built state rather than from the plan. The
plan file keeps its own step checkboxes; this file records what a reader of
that plan could not infer.

## What shipped

**Backend.** A `summary(month, year)` query returning `totalBalance`,
`monthIncome` and `monthExpense`. `totalBalance` is all-time, the sum of every
`INCOME` minus every `EXPENSE` across the user's whole history. `monthIncome`
and `monthExpense` cover only the requested calendar month, computed with a
UTC window — `Date.UTC(year, month - 1, 1)` inclusive to
`Date.UTC(year, month, 1)` exclusive — built with two `groupBy` calls inside
one `prisma.$transaction`, both filtered by `userId` in their own `where`
clause. `monthExpense` is unsigned, like `Category.totalAmount`; the client
applies the sign. Validation (`summaryArgsSchema`) runs before Prisma: `month`
1–12, `year` 1970–9999, each out-of-range value reported as `BAD_USER_INPUT`
naming the failing field. No migration — this slice added no model.

**Frontend.** The dashboard screen at `/`, replacing the placeholder
`routes.tsx` swapped in. Three stat cards (Saldo total, Receitas do mês,
Despesas do mês) driven by `useSummaryQuery` against `currentPeriod` (the
browser's local month/year). Two panels below: "Transações recentes", reusing
the paginated `transactions` query at `limit: 5` rather than a dedicated
field, and "Categorias", sorted by total amount descending and capped at five
on the client from the existing `categories` query. Each of the three
sections — stat card row, recent-transactions panel, categories panel — owns
its own query and its own loading/empty/error states, so one section's
failure does not blank the others. The dashboard mounts the same
`TransactionDialog` and `DeleteTransactionDialog` the transactions page uses,
unmodified.

`prisma/seed.ts` was re-based off `monthsBack(monthsAgo, day, now?)`, extracted
so its December-rollover arithmetic is unit-testable outside `main()`. All
twenty-seven rows keep their description, amount, type and category; only the
date moves, spread across the twelve months ending in the current one, so the
period select's thirteen options (from slice 4) each have something to select
and the dashboard is never a wall of zeros on a fresh clone.

**Verification at the end of this slice**, all through `rtk proxy`, re-run at
the final commit before this one:

- `npm test -w @financy/backend` — 276 tests, 26 files, all passing.
- `npm test -w @financy/frontend` — 324 tests, 51 files, all passing.
- `npm run typecheck` — exit 0, both workspaces.
- `npm run lint` — exit 0.
- `npm run format:check` — exit 0, "All matched files use Prettier code
  style!".
- `npm run codegen:check -w @financy/backend` — exit 0, no diff.
- `npm run codegen:check -w @financy/frontend` — exit 0, no diff.
- `git diff package.json apps/backend/package.json apps/frontend/package.json`
  — empty. No task in this slice installed anything.

Every number above matches what this task was handed at the start; none
differed on re-run.

## Where the build departed from the plan

| Departure | Why |
|---|---|
| **[design correction 1]** The empty state is `R$ 0,00` on all three stat cards, not `-R$ 0,00` on Despesas do mês | The design's states table says the empty state is `R$ 0,00` on all three cards, and separately says "Despesas do mês" renders through `formatSignedAmount(monthExpense, 'EXPENSE')`. Taken literally together those two statements produce `-R$ 0,00` for a new user. Resolved: the sign is applied only to a non-zero expense; zero renders as plain `R$ 0,00`, matching the table (Task 5). |
| **[design correction 2]** "Receitas do mês" renders with no `+` | The design names `formatSignedAmount` only for "Despesas do mês"; "Receitas do mês" renders through plain `centsToDisplay`. Also what keeps the empty state `R$ 0,00` on all three cards rather than `+R$ 0,00` on one of them (Task 5). |
| **[design correction 3]** There is no "fixed RNG seed" to preserve | The design's text for the seed re-base says "the fixed RNG seed stays, so descriptions, amounts, types and category assignments remain reproducible." `seed.ts` has no RNG — its twenty-seven rows are literals. The intent held exactly as written otherwise: every row keeps its description, amount, type and category; only the date moves (Task 9). |
| **[design correction 4]** "Salário de julho" and "Salário de agosto" become "Salário" | Both descriptions named a specific month. Once dates are relative to "now" rather than fixed in mid-2026, both names go wrong as soon as the seed is re-run in a different month. Renamed to the month-agnostic "Salário" (Task 9). |
| Task 5's plan-prescribed fixtures made two stat cards collide on text | Two of the plan's six test fixtures produce identical rendered strings on two different cards: `{-12_345, 0, 12_345}` puts "-R$ 123,45" on both Saldo total and Despesas do mês; `{100, 100, 0}` puts "R$ 1,00" on both Saldo total and Receitas do mês. Both are unavoidable consequences of the plan's own two sign rules, so the plan's singular `findByText` could never pass for those fixtures. Resolved by changing only query cardinality — `findAllByText(...).toHaveLength(2)` — which still catches the fault the assertion was written for: a dropped sign moves the count off 2. Reviewer worked the arithmetic independently before approving. |
| Task 7 hit the same class of collision, and the first fix silently dropped coverage | `CategoriesPanel` renders the category name twice per row (an `<h3>` and a `<Tag>`), so the plan's `findByText('Mercado')` matched two elements and threw, exactly as flagged for it in the Task 5 ledger note. The implementer's fix used `findByRole('heading', { name })` — strictly stronger for the heading, but it silently dropped all coverage of the `<Tag>`. Caught in review (deleting the `<Tag>` failed 0 of 7 tests); closed with an explicit `getAllByText('Mercado').toHaveLength(2)` alongside the heading query. |
| Task 8's headline invalidation test had a hollow categories leg | The slice's test asserting all three dashboard sections refetch after a transaction mutation was hollow on its categories leg: `TransactionDialog` calls `useCategoriesQuery()` itself when it opens, so the categories count rose from the dialog's own fetch before the mutation ever fired. Deleting the dialog's category invalidation would not have reddened this test — it was passing for the wrong reason. Escalated to the owner, who ruled it be fixed. The baseline now settles after the dialog's own fetch, and a mutation-check confirms the test fails correctly (`"expected 2 to be greater than 2"`) when the invalidation is removed. The Summary and Transactions legs were sound throughout and were not weakened by the fix. |

## Spec corrections made in this slice

- `roadmap.md`'s slice-5 row credited `categoryStats`, the per-category
  aggregates and the DataLoaders to this slice. All three shipped in slices 2
  and 3; this slice added only `summary`. Corrected to name what actually
  shipped here and where the rest came from.
- `backend.md` section 5, aggregate semantics: `monthIncome`/`monthExpense`'s
  window is now stated precisely as UTC (`Date.UTC(year, month - 1, 1)`
  inclusive to `Date.UTC(year, month, 1)` exclusive) rather than the vaguer
  "first instant of day 1 to the last instant of the final day", with the
  reasoning for UTC over server-local. Added that `monthExpense` is unsigned
  like `Category.totalAmount`. Added the `year` bound (1970–9999) to the
  `month` validation bullet, since `summaryArgsSchema` validates both.
- `frontend.md` section 5, Dashboard: the panel list now states that each of
  the three sections owns its own query and its own loading/empty/error
  states, states the `R$ 0,00`-on-all-three-cards empty state explicitly,
  states that "Transações recentes" reuses the paginated `transactions` query
  at `limit: 5` rather than a dedicated field, and that "Categorias" sorts and
  caps on the client because `categories` returns the whole list.
- `frontend.md` section 12, one new entry: the summary month window is UTC
  while the dashboard reads the local month, with the UTC-3 boundary example
  and the rejected alternatives (`dateFrom`/`dateTo` arguments, a
  server-local window). This closes the forward reference two source
  comments already carried — `apps/backend/src/modules/summary/service.ts`
  and `apps/frontend/src/lib/period.ts:92` both cite `frontend.md` section 12
  for this deviation; without this entry those citations pointed at nothing.

## The invalidation this slice existed to make live

`['Summary']` had been invalidated from both `TransactionDialog` and
`DeleteTransactionDialog` since slice 3, with no consumer to match it —
recorded as open in both `slice-3-outcome.md` and `slice-4-outcome.md`. The
generated `useSummaryQuery.getKey({month, year})` produces
`['Summary', {month, year}]`, so both invalidation calls now match by prefix
against the dashboard's live query. Task 4 controller-verified the generated
key text directly; Task 8's mutation test confirms the summary panel refetches
after a transaction create/update.

`DeleteTransactionDialog.tsx:52` fires the same `['Summary']` key, but no test
in this slice exercises a delete. It works by construction — the same prefix
match Task 8 verified for create/update applies identically to delete — but
that is an inference, not an observed test result. The owner ruled a delete
test out of scope for this slice. This is carried into "Open going into
slice 6" below.

## Process note: lost agent sessions

Five agent sessions were lost to API connection errors mid-task during this
slice — Task 7 lost two (the implementer's fix-round session, then the first
re-review session), and Task 8 lost four across its RED-writing and
implementation phases (recorded together as one entry in the ledger for that
task). This is a gap in the self-reported evidence chain for those two tasks,
not a doubt about the shipped code, which was reviewed clean in both cases
after the sessions recovered:

- **Task 7**: the implementer's session died with the `<Tag>`-coverage fix
  already committed but its fix report unwritten; the first re-review agent
  died the same way before filing anything. The controller ran the mutation
  check itself — deleting the `<Tag>` assertion's target failed 1 of 7 tests,
  restoring it passed 7/7, gate green — and wrote that evidence into
  `task-7-report.md` explicitly labelled as controller-produced, then
  re-dispatched a fresh re-review agent to close the task normally.
- **Task 8**: four consecutive sessions died to connection errors across the
  RED-writing and implementation work. The failing tests survived in the
  working tree between deaths; a fresh implementer, on a different model,
  finished the task from the preserved RED state rather than restarting from
  scratch.

`slice-4-outcome.md` recorded the identical failure mode for its own Task 8.
This is the second slice in a row it has happened, now against two different
tasks in the same slice rather than one.

## Open going into slice 6

- **`DeleteTransactionDialog.tsx:52`'s `['Summary']` invalidation has no test
  in this slice.** Works by construction (same key-prefix match Task 8
  verified for create/update), but unexercised. The owner ruled it out of
  scope here; a slice that next touches delete behavior should close it.
- **The `/style-guide` primitive comparison** is still unanswered, now open
  across five slices with no visual regression yet reported against it. This
  slice added no new primitive, so nothing new is owed against it.
- **The category card's tag repeating the category name** is still
  unconfirmed since slice 2 (`slice-2-figma-handoff.md`). This slice's
  "Categorias" panel repeats the identical treatment, so a correction there
  would now apply in two places instead of one.
- **`slice-5-figma-handoff.md`'s "New this slice" section** — the dashboard's
  subtitle, the three stat cards' labels/icons/tints, the two-panel
  responsive layout, both panels' row compositions, and the inset
  `PanelError` nesting, all built and ready for the owner to check against
  Figma.
- **No CI.** Nothing runs the checks on push. Every number in this file came
  from a local run, through `rtk proxy`.

## Deferred minors, from this slice's ledger

Reviewed and deliberately shipped as-is; none reached this task as unresolved
code:

- Task 1: the implementer ran `format:check` after Prettier rather than
  before the commit; the final committed state is formatted, so this is a
  process nit only, not a gate failure.
- Task 2: `service.ts`'s `TypeSum` type is hand-declared rather than derived
  from Prisma's generated `groupBy` output type. The shape is trivial and
  stable, so this was not worth the derivation.
- Task 5: the two fixture-collision tests (see "Where the build departed from
  the plan" above) are not card-scoped — neither uses `within()` — so a
  reader could misread what they prove without the in-file comments that
  mitigate it.
- Task 5: `mockSummary`'s inline parameter typing is brief boilerplate.
- Task 6: the panel body's state switch is a three-way nested ternary,
  matching `TransactionsPage`'s existing style; left alone rather than
  extracted.

Everything on `slice-4-outcome.md`'s "Open going into slice 5" and deferred-
minors lists, in files this slice did not open, carries forward unchanged to
slice 6, per the same rule slice 4 applied to slice 3's list: an item is in
scope only if the slice already opens its file. The one exception is the
`['Summary']` invalidation item above, which this slice's whole purpose was to
resolve, and did.

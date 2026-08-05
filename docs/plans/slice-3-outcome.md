# Slice 3 — outcome

Status: code-complete on `feat/slice-3-transactions`, HEAD `d1dc31f` before this
task's own commit. Not yet merged — a whole-branch review runs after this
document, ahead of the pull request.

What [`slice-3-transactions.md`](./slice-3-transactions.md) planned and what
actually landed, so slice 4 starts from the built state rather than from the
plan. The plan file keeps its own step checkboxes; this file records what a
reader of that plan could not infer.

## What shipped

**Backend.** A `transaction` module in the same four-file shape as `auth/` and
`category/`: zod schemas for create/update/list, a service taking `userId`
first and filtering by it in every `where` clause — including both halves of
the paginated list (`findMany` and `count`, wrapped in one `prisma.$transaction`
so they always agree) and the `categoryById` DataLoader's batch query — the SDL,
and thin resolvers. Offset pagination with a `date` + `createdAt` tiebreaker, so
two same-date rows have a defined order across pages. A category attached at
create or update time has to belong to the same caller, checked before the
write, `NOT_FOUND` rather than `FORBIDDEN` so the check does not confirm the
foreign id is real. `prisma/seed.ts` now seeds categories and transactions in
one commit, with `SEED_PASSWORD` read from the environment rather than a
plaintext literal.

**Frontend.** `lib/currency.ts` and `lib/format.ts` for the cents-first amount
mask and date conversions. A `SegmentedControl` primitive for the
income/expense toggle. `PanelError` (`role="alert"`) and `Skeleton`
(`role="status"`) shared primitives, plus four accessibility carry-overs from
slice 2 (edit-before-delete order, `<h3>` card headings, and the two roles just
named). The transaction dialog serving create and edit from one form, with the
amount and category fields `Controller`-driven. The delete confirmation naming
the transaction. The transactions page: a real `<table>` under
`overflow-x-auto`, four states (loading, empty, error, populated) each gated on
`totalCount` rather than `items.length`, and an out-of-range page number that
clamps to the last valid page with `replace: true` rather than dead-ending on
"Nenhuma transação ainda". Both dialogs mount only while open.

**Verification at the end of this slice**, all through `rtk proxy`:

- `npm test` — backend 210 tests (22 files), frontend 239 tests (44 files), all
  passing.
- `npm run typecheck` — exit 0, both workspaces, no `any` introduced.
- `npm run lint` — exit 0.
- `npm run format:check` — exit 0, "All matched files use Prettier code style!".
- `npm run codegen:check -w @financy/backend` — exit 0, no diff.
- `npm run codegen:check -w @financy/frontend` — exit 0, no diff.

## Where the build departed from the plan

| Departure | Why |
|---|---|
| Task 12's transaction dialog uses `Controller` for `categoryId`, not `form.register` | The plan's own Step 4 sample registers the select natively. React Hook Form 7.84.0 sets `select.value` during the ref callback's first attach, before the async category list has rendered anything but the empty placeholder `<option>` — the DOM value becomes `''`. Every later render's ref callback short-circuits before `updateValidAndValue` runs again, so nothing ever re-applies the value once the real options arrive. The plan's own accompanying `toHaveValue('category-1')` test can never pass against its own sample code. `Controller` plus a placeholder `<option>` for the current category until the real list loads is the minimal fix; the plan's Task 12 Step 4 is corrected in this same commit. |
| Task 7's seed password reads from `process.env.SEED_PASSWORD`, not a literal in `prisma/seed.ts` | The plan's original draft wrote a plaintext literal into the seed file and proposed exempting it in `.gitguardian.yaml`. Both are forbidden by the standing constraint that password-shaped literals live only in the two credentials files. The owner ruled: read from env, no exemption — `const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'trocar-esta-senha'`. This is the slice's one new environment variable; see below. |
| Task 14's empty state gates on `totalCount === 0`, not `items.length === 0`, and an out-of-range page redirects to the last valid page | Review found the shipped-as-planned version left a dead end: deleting the last row on the last page (or hand-typing `?page=99`) landed on the empty state with no visible way back, because the empty branch never consulted `totalCount` and `<Pagination>` only rendered in the populated branch. Fixed post-review, not in the plan. |
| Task 14 added a new `routes.test.tsx` case instead of repurposing an existing one | The plan's Step 6 assumed a signed-in `/transactions` visit was already covered there; none existed. |
| Nine of the build's fourteen tasks needed at least one plan-prescribed test strengthened after review, closed additively without touching the production code it covers | See "Test quality, for slice 4's plan" below. |

Every other departure recorded task-by-task in
[`progress.md`](../../.superpowers/sdd/slice-3-transactions/progress.md) —
extra cross-user cases, mixed-batch DataLoader ordering, the removed
`Math.trunc(... / 100)` in `currency.ts` — was a strengthening closed inside its
own task, with the production code left as the plan specified or corrected to
match a constraint the plan itself states elsewhere (no division in
`centsToDisplay`). None reached this task as open work.

## Spec corrections made in this slice

- `backend.md` §7: the pagination validation line now states which bound
  rejects (`limit` below 1, `offset` below 0 — `BAD_USER_INPUT`) and which
  clamps (`limit` above 100, silently, per §5's "regardless of what the client
  sends").
- `frontend.md` §12: three entries added — the transactions table scrolling
  horizontally below the medium breakpoint, the page number living in the URL
  from this slice (so slice 4's filter-driven reset has something that already
  exists to reset), and the amount field's cents-first mask.
- `roadmap.md`: pagination moved from slice 4's row to slice 3's, in both the
  slices table and the "What each slice delivers" paragraphs — it was built
  here, which is where `backend.md` §5 always said it belonged. Slice 4's name
  shortened to "Search and filters" to match.
- `slice-3-transactions.md`'s own Global Constraints line, which asserted this
  slice adds no environment variable, corrected to name `SEED_PASSWORD` — see
  below.
- `slice-3-transactions.md`'s Task 12 Step 4 sample corrected to match what
  shipped (`Controller` plus a placeholder `<option>`), with an inline comment
  explaining why the plan's original `form.register` shape cannot pass the
  plan's own test. See "Where the build departed from the plan" above.

## This slice's one environment variable

The plan's Global Constraints line originally read "this slice adds none." It
does not: Task 7's development seed needs a password, and the owner's ruling on
that task (read from `process.env.SEED_PASSWORD`, no `.gitguardian.yaml`
exemption) means a real environment variable now exists. It is in
`apps/backend/.env.example`:

```
SEED_PASSWORD=trocar-esta-senha
```

`prisma/seed.ts` falls back to that same placeholder when the variable is
unset, so `npm run db:seed` works with no `.env` present; a developer who sets
a real one gets it logged to stdout on every seed run (`seed.ts:303`), which
matters only if someone sets a real one — noted here as a Task 7 deferred
minor, not fixed in this task.

## Slice 2's parked defect, resolved

`slice-2-outcome.md`'s "Parked, with the ruling" section carried one open item:
cancelling a category dialog mid-submit can call `setFormError` after the
dialog has unmounted (mounting-only-while-open makes this reachable), logged no
warning on React 18+, and was left as-is with the note "Slice 3 adds a second
dialog with the same shape and is the right place to settle it once."

Checked directly against the shipped `TransactionDialog.tsx`: it has the same
shape (mounted only while `dialogOpen`, `setFormError` called unconditionally
in the mutation's `catch` block) and the same property holds — calling
`setState` after unmount is a silent no-op on React 19.2.8, confirmed by
grepping the diff for any `isMounted` ref or `AbortController` guard (none
exists in either dialog). The plan's own "Decisions this plan encodes" table
independently reached the same conclusion: **moot, not fixed**, because the
alternative — disabling "Cancelar" while submitting — traps a user behind a
slow request, and an abort-signal pattern is not something this codebase has a
precedent for yet. `slice-2-outcome.md`'s "Parked, with the ruling" section is
edited in this commit to replace the full item with a one-line pointer to this
section — not a bare deletion, since slice 2's own text nominated this slice as
where it would be settled, and this section is where that ruling now lives.

Separately, and worth naming because it guards a related but distinct
property: this slice's Task 12 review carried forward a *different* concern
about the same "mount only while open" pattern — that nothing in the plan's
prescribed tests toggled the dialog closed and reopened it on a different
target, so a regression to keying-and-reusing the component (the bug slice 2's
final review actually found and fixed in `CategoryDialog`) would ship
undetected. That gap was closed in Task 14 with a dedicated test,
`'opens a second edit holding the newly chosen row, not the first'`
(`TransactionsPage.test.tsx:238`), teeth-verified by mutating the mount
condition to a permanent one, watching it fail, and reverting.

## Test quality, for slice 4's plan

Nine of this slice's fourteen build tasks shipped at least one plan-prescribed
test that, on inspection, would not have failed if the property it was meant to
guard had been removed — ten individual gaps in total, since Task 6 had two.
The implementation was correct in every one of these cases; the plan's own test
code was the weak part, and every instance was closed additively (a test added
or strengthened) without changing the production code it exercises. In order:

1. Task 1 — the P2002 duplicate-name race test never reached the `catch`
   branch it was meant to cover, because the pre-check throws first.
2. Task 2 — `updateTransactionSchema` had no test at all for `type` or `date`;
   dropping `.optional()` from either broke nothing.
3. Task 4 — a `limit` below 1 was never pinned end-to-end through
   `listTransactions`; the unit test it leaned on asserted only the error
   message, not `extensions.code`.
4. Task 5 — the DataLoader's five prescribed tests never mixed a batch with a
   diverging key order, so a positional (rather than key-matched) return would
   still have passed.
5. Task 6 — no test ever sent `limit`/`offset`, so a resolver that ignored its
   arguments passed all nineteen HTTP tests.
6. Task 6 — the fixture's transactions all had null `categoryId`, so no test
   would catch `Transaction.category` regressing from the DataLoader to a
   per-row query.
7. Task 8 — the currency round-trip test omitted `MAX_CENTS`, so the boundary
   the property was meant to prove was never reached.
8. Task 11 — the `<h3>` card-heading carry-over had no regression test; a span
   reversion would have broken nothing.
9. Task 12 — three of the four field-error mappings (`amount`, `date`,
   `categoryId`) were untested; only `description` was exercised.
10. Task 12 / 14 — no prescribed test toggled the transaction dialog closed and
    reopened it on a different target, the gap closed by Task 14's test named
    above.

Slice 4's plan should not reuse a prescribed test block from this slice, or
write a new one, without asking: **would this fail if the rule it guards were
removed?** A test that only exercises the happy path a correct implementation
would produce anyway is not evidence of anything.

## Open going into slice 4

- **`TransactionFilter` is unbuilt**, and the `transactions` query has no
  `filter` argument. Slice 4 adds both, plus the filter bar and the URL state
  for it. The page number is already in the URL, from this slice.
- **The delete-on-last-page flow now depends on the pagination clamp effect**
  (`TransactionsPage.tsx`). If slice 4 adds "changing a filter resets to
  page 1," that reset must not race the clamp effect — both would want to
  rewrite the page in the URL from the same render.
- **`['Summary']` is invalidated with no consumer**, from both the transaction
  dialog and the delete confirmation. Slice 5 has to confirm the generated
  `Summary` query key matches that literal, or both invalidations are silent
  no-ops — the same bet slice 2 made on `['Transactions']`, which Task 9
  checked with a test. Slice 5 should add the matching test.
- **The dashboard is still a placeholder** in `routes.tsx`, and `Placeholder`
  exists only for it.
- **`prisma/seed.ts` has fixed dates in July and August 2026.** The dashboard's
  "current month" figures will read zero whenever the wall clock is outside
  that window. Slice 5 either re-bases the seed on the current month or accepts
  it.
- **The `/style-guide` primitive comparison** is still unanswered. Carried from
  slice 0, through slices 1 and 2, and now open across three slices with no
  visual regression yet reported against it.
- **`slice-3-figma-handoff.md`'s "New this slice" section** — the transactions
  page, the dialog, and the delete confirmation, all built and ready to
  compare.
- **No CI.** Nothing runs the checks on push. Every number in this file came
  from a local run, through `rtk proxy`.

## Deferred minors, for the whole-branch review to triage

Not fixed in this task, by design — this document records what shipped, not
what should change next. Full detail, task by task, is in
[`progress.md`](../../.superpowers/sdd/slice-3-transactions/progress.md):

- No test that `updateTransactionSchema` preserves a real non-empty
  `categoryId` unchanged, or trims whitespace on either transaction schema.
- A stale comment at `src/schema.ts:10-11` says only the category module
  extends `Mutation`; the transaction module now does too.
- `codegen:check` uses `git diff --exit-code` (unstaged-only), so it would pass
  on a dirty tree once files are staged — a roadmap-level fix, not scoped to
  this slice.
- `seed.ts:303` logs the resolved `SEED_PASSWORD` on every run; harmless for
  the placeholder, would echo a real value if a developer set one.
- `digitsToCents`'s `.slice(0, 15)` guard is unreachable in practice.
- No test exercises `formatSignedAmount(0, ...)`.
- The two TZ pins (the npm script prefix and `vite.config.ts`'s `test.env`)
  would disagree silently if ever edited independently.
- `SegmentedControl`'s `options` is typed as an unbounded array, but the layout
  hardcodes `grid-cols-2`.
- No test asserts the danger/success tone classes land on the selected segment
  (jsdom limitation, consistent with the existing picker convention).
- `PanelError`/`Skeleton` don't spread `...rest` or extend `HTMLAttributes`,
  unlike `Card`/`Button`; a future caller needing an `id` or `data-testid`
  would need a signature change.
- The transaction dialog's placeholder `<option>` can't distinguish "still
  loading" from "category was deleted"; `categories.isError` is never read.
- A `type` field error falls through to the generic banner; `SegmentedControl`
  has no error slot.
- The submitting state (`loading={pending}`) is implemented but untested.
- The update path's invalidations are untested directly (the shared
  `invalidate()` helper means the create-path test would very likely catch a
  regression).
- No dedicated `TransactionRow.test.tsx`; coverage is indirect, through
  `TransactionsTable.test.tsx`.
- Two tasks (6 and 14) had their first-dispatched review agent die to
  infrastructure — an API session limit and the account's weekly limit,
  respectively — mid-review with no verdict, and were re-reviewed on a fresh
  agent against the same diff. Task 13's implementer was separately terminated
  mid-build by a session limit and left the working tree with one invalidation
  deliberately (and, at that point, permanently) removed as an in-progress
  teeth check; a fresh implementer inherited that state, was told about it
  explicitly, and restored it. All three are recorded in `progress.md` in
  full; none reached this task as unresolved code.

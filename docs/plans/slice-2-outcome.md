# Slice 2 — outcome

Status: merged to `main` in pull request #5, on 2026-08-04.

Two changes landed after the branch review, at the owner's request: the toast
surface is tinted per variant rather than carrying the variant on its icon
alone, and its viewport moved to the top right.

What [`slice-2-categories.md`](./slice-2-categories.md) planned and what actually
landed, so slice 3 starts from the built state rather than from the plan. The
plan file keeps its own step checkboxes; this file records what a reader of that
plan could not infer.

## What shipped

**Backend.** `Category` and `Transaction` in one migration, with `Transaction`
deliberately API-less this slice — `Category`'s public contract carries
per-category aggregates and deleting a category has to unlink transactions
rather than delete them, and neither is testable without the second table. The
category module under `src/modules/category/` in the same four-file shape as
`auth/`: zod token lists and schemas, a service taking `userId` first and
filtering by it in every where clause, the module SDL, and thin resolvers. The
first DataLoader in `src/shared/dataloaders.ts`, built per request inside
`createContext` so a caller's totals cannot be served to the next request.
`Mutation._empty` is gone — the placeholder existed only so `extend type
Mutation` had something to extend.

**Frontend.** Typed hooks for the five operations, with `enumsAsTypes` so a
queried `icon` is the same union the theme table is keyed by. The toast
primitive on Radix, which settles the deviation slice 1 recorded. Two native
radio-group pickers. The category dialog serving create and edit from one form.
The delete confirmation that states the transactions survive. The categories
page with its stat row and card grid, each panel owning its own loading, empty,
error and populated states. `Card` gained an `as` prop so a card is an
`article`.

**Verification at the end of the slice.** 131 backend and 165 frontend tests,
`typecheck`, `lint`, `format:check`, and `codegen:check` in both workspaces
reporting exit 0. Run through `rtk proxy`, because the RTK filter can report a
pass for a command that failed.

## Where the build departed from the plan

| Departure | Why |
|---|---|
| A new task 2b, mid-slice | The plan asked the owner to confirm sixteen icon tokens that nothing rendered by name. The gate was unanswerable, so 2b added the labelled `/style-guide` galleries and pulled the Portuguese labels forward from task 9. |
| The plan's `description` transform crashed on an explicit `null` | It special-cased `undefined` and then called `.length` on a null. Fixed with a null branch, same structure. |
| `context.test.ts` no longer compares whole context objects | Two `DataLoader` instances are never structurally equal, so the plan's `toEqual` could not pass. The per-scenario `userId` assertions stayed; the loader is checked with `toBeInstanceOf`. |
| The batching test spies on `prisma.transaction.groupBy` | The plan's `$on('query')` form needs a client built with `log: ['query']`, which this one is not. The fallback it authorized proved mapping under a batch but not that one query was issued — the spy proves the property the loader exists for. |
| `src/schema.ts` is annotated `export const resolvers: Resolvers` | Without it, TypeScript treats `Category: categoryResolvers.Category` as a required key holding possibly-`undefined`, which Apollo's `IResolvers` index signature rejects. The annotation keeps excess-property and per-field checking. |
| `role="status"` was added to the toast root, then removed | Radix already renders its own announcer; the added role duplicated it for about a second per toast. The test waits on the content instead. |
| The dialog watches with `useWatch`, not `form.watch` | `form.watch()` cannot be memoized and lint says so. `useWatch` subscribes to the same fields and leaves the pickers uncontrolled. |
| `test/setup.ts` gained a pointer-capture polyfill | jsdom implements none of `hasPointerCapture`/`setPointerCapture`/`releasePointerCapture`, which Radix Toast's swipe handler calls. Each stub is guarded, so it can only fill a missing method. |

## Spec corrections made in this slice

- `backend.md` §7: a duplicate category name is `BAD_USER_INPUT` with
  `fieldErrors.name`. The unique constraint was reachable from the API with no
  code covering it.
- `backend.md` §5: `mostUsed` is null when no transaction of the user's has a
  category — whether they have none at all, or every one is uncategorized. The
  old wording only covered the first case.
- `frontend.md` §12: the toast deviation is deleted; three new entries record
  the card's tag content, the picker's neutral icon rendering, and the two
  default selections.

## Open going into slice 3

- **The `/style-guide` primitive comparison** is still unanswered. It is carried
  from slice 0 and now gates nothing, but it is the last unchecked visual item
  from before this slice.
- **The "new this slice" section of
  [`slice-2-figma-handoff.md`](./slice-2-figma-handoff.md)** — the categories
  page, the dialog, the delete confirmation and the toast, all built and ready
  to compare. Three of its questions are the `frontend.md` §12 entries above.
- The sixteen icon names **are** confirmed, as of 2026-08-03.

## What the final review caught

One blocking defect, in `CategoriesPage`: `CategoryDialog` was permanently
mounted and keyed on the edit target, so create → create and
edit → cancel → edit-the-same-category reopened the form holding the previous
values and a stale error banner. Adding several categories in a row is the
primary flow of this feature, and the second one would have been rejected as a
duplicate of the first. Fixed by mounting the dialog only while it is open,
matching what `DeleteCategoryDialog` already did, with three reopen tests that
did not exist before.

Two smaller ones, fixed in the same wave: both dialogs re-enabled their submit
button the moment the mutation resolved, leaving a window during the awaited
invalidation where a second click fired it again; and the style guide's badge
count had become vacuous once the icon picker put sixteen more matching
elements on the page.

The review found the backend clean end to end — `userId` in the where clause of
every read and write including the loader's batch query, cross-user `NOT_FOUND`
covered at both the service and transport layers.

### Parked, with the ruling

**Cancelling mid-submit can set state on an unmounted dialog.** Now that the
dialog unmounts when closed, cancelling during an in-flight save lets the
handler's later `setFormError` run against a gone component. Functionally
harmless — the mutation still completes and nothing crashes — but it can log a
development warning. Left as-is: disabling "Cancelar" while submitting traps a
user behind a slow request, and the alternative fix is an abort signal this
codebase has no pattern for yet. Slice 3 adds a second dialog with the same
shape and is the right place to settle it once.

### Follow-ups it raised, none blocking

- `parseInput` lives in `modules/auth/validation.ts` and is now imported by the
  category module. It is a generic zod-to-`BAD_USER_INPUT` helper and belongs in
  `src/shared/`; every future module will otherwise import it from auth.
- `createCategory` checks the name and then writes, so a concurrent duplicate
  raises P2002 and surfaces as `INTERNAL_SERVER_ERROR` rather than the
  `BAD_USER_INPUT` this branch wrote into `backend.md` §7. A `try/catch` mapping
  P2002 closes it.
- Both skeleton containers carry `aria-label` on a plain `div`, which is not
  reliably exposed; they want `role="status"` and `aria-busy`. The tests read
  the attribute directly, so this looks covered and is not.
- `PanelError` has no `role="alert"`, so a failed refetch announces nothing.
- On a category card, delete precedes edit in DOM order, putting the destructive
  action first for keyboard users.
- A card's name is a `<p>`; an `<h3>` would give the grid a heading structure.
- `IconPicker` and `ColorPicker` take a `registration: UseFormRegisterReturn`,
  coupling two design-system primitives to React Hook Form — visible in the
  style guide, which has to hand-fake one. A `name`/`value`/`onChange` surface
  would be library-agnostic.
- `CategoryStats.mostUsed` selects `icon` and `color` that nothing renders.

## Debts slice 3 inherits

- **`prisma/seed.ts`.** Still deferred. It seeds categories and transactions,
  and now that both tables exist it can land in one commit.
- **The `Transaction` table exists with no API.** Slice 3 adds the SDL, the
  resolvers, the service and the UI on top of it, and needs no migration of its
  own unless it changes a column.
- **`resetDatabase` deletes children first.** Anything slice 3 adds goes above
  `category.deleteMany()`.
- **`['Transactions']` is already invalidated** by `DeleteCategoryDialog`, with
  no consumer until slice 3. Confirm the generated `Transactions` query key
  matches that literal, or the invalidation is a silent no-op.
- **`createTransaction`'s factory default date is a fixed constant.** The first
  date-range test that forgets to override it could pass by coincidence.
- **Two tasks shipped without an independent review.** Tasks 10 and 12 — the
  category dialog and the categories page — lost their reviewers to an account
  session limit and were finished and checked by the controller instead. The
  final whole-branch review covers them, but they had no second pair of eyes at
  task level.
- **No CI.** Nothing runs the checks on push. Every number in this file came
  from a local run.

# Implementation Roadmap

How Financy gets built. The specs say what to build
([`backend.md`](../specs/backend.md), [`frontend.md`](../specs/frontend.md));
this document says in what order, in what increments, and what "done" means.

## Principle

**Every increment is a vertical slice.** A slice delivers a working feature
across both applications — API, UI and tests — rather than a layer across the
whole app. Building all of the backend and then all of the frontend would mean
months before anything is usable and a long tail of integration surprises at the
end. Slicing vertically means every merge to `main` leaves a running application
that does one more thing than it did before.

Within a slice, the backend leads. The frontend's typed hooks are generated from
the backend's schema, so the schema has to exist first.

## Slices

| # | Name | Backend | Frontend |
|---|---|---|---|
| 0 | Foundations | Prisma, Apollo, Express, CORS, env validation, health query | Vite, Tailwind theme, design system primitives, app shell |
| 1 | Auth and profile | `User`, `signUp`, `signIn`, `me`, `updateProfile`, JWT, context, auth guard | Login, sign up, profile, session context, route guards |
| 2 | Categories | `Category`, full CRUD, ownership enforcement | Categories page, card grid, category dialog, delete confirmation |
| 3 | Transactions | `Transaction`, full CRUD, offset pagination, category unlink on delete | Transactions page, table, pagination, transaction dialog, delete confirmation |
| 4 | Search and filters | `TransactionFilter` | Filter bar, URL-backed filter state |
| 5 | Dashboard | `summary` (`categoryStats`, the per-category aggregates and the DataLoaders shipped in slices 2 and 3) | Dashboard stat cards and panels |

### What each slice delivers

**Slice 0 — Foundations.** Both applications start, are typed, are tested, and
have a passing test suite with nothing meaningful in it yet. The design system
is built first, from the Style Guide, as the Figma file's own guidance
recommends: with the primitives in place, every later screen is assembly rather
than invention. Ends with both apps running side by side and a route that
renders every primitive in every state.

**Slice 1 — Auth and profile.** A person can create an account, sign in, see a
protected shell, edit their name and sign out. Private routes redirect when
signed out; public routes redirect when signed in. Includes the profile page
because it is the only place the design puts a sign-out control.

**Slice 2 — Categories.** Full category management with icon and color pickers.
Chosen before transactions because a transaction references a category, and
building the referencing entity first means seeding fake categories to test it.

**Slice 3 — Transactions.** Full transaction management, including the currency
conversion to and from integer cents, offset pagination, and the uncategorized
state. At the end of this slice the application does everything the
requirements literally ask for.

**Slice 4 — Search and filters.** The transactions page becomes usable with real
volumes of data, on top of the pagination slice 3 already built. Filter state
lives in the URL beside the page number, which is already there.

**Slice 5 — Dashboard.** Aggregates on the server, dashboard on the client. Last
because it summarizes data that only exists once the previous slices are done.

## Definition of done

A slice is not done until every line below is true. This list is the review
checklist for its pull request.

**Both applications**

- [ ] Every new behavior has a test, and the tests pass.
- [ ] `tsc --noEmit` passes with no errors and no `any` introduced.
- [ ] Lint passes.
- [ ] Any new environment variable is in the matching `.env.example`.
- [ ] The specs still describe what was built. If the implementation revealed
      something the spec got wrong, the spec is corrected in the same PR.

**Backend**

- [ ] Every new query and mutation filters by the calling user, in the where
      clause.
- [ ] Cross-user access is covered by a test asserting `NOT_FOUND`.
- [ ] Inputs are validated by zod before reaching Prisma.
- [ ] Any schema change has a committed Prisma migration.

**Frontend**

- [ ] Loading, empty, error and populated states are all implemented.
- [ ] Destructive actions confirm first.
- [ ] The screen was compared against the Figma frame, and any deviation is
      recorded in `frontend.md`, section 12.
- [ ] Interactive elements are reachable by keyboard and labelled for screen
      readers.

## Testing strategy

Both applications use Vitest, so there is one test runner and one mental model.

### Backend

The weight is on **integration tests**: real GraphQL operations executed against
a real SQLite database, reset between tests. They exercise the resolver, the
service, the validation and Prisma together — which is where the bugs actually
are. A unit test of a resolver with a mocked service mostly asserts that the
mock was called.

Unit tests are used where there is pure logic worth isolating on its own:
validation schemas, date-range boundaries, aggregate arithmetic.

Every slice that adds a query or mutation adds, at minimum:

- the success path
- each validation failure
- the unauthenticated case
- the cross-user case, asserting `NOT_FOUND`

The cross-user tests are the ones that matter most. Ownership is the rule that
breaks silently: nothing crashes, no error appears, one user simply sees
another's money.

### Frontend

Tests drive the interface the way a person does — find the field by its label,
type, click the button, assert what appears. Tests that reach into component
internals break on every refactor while proving nothing about the product.

The GraphQL layer is mocked at the network boundary with MSW, so tests run
through the real client, the real query cache and the real invalidation logic.
Mocking the hooks instead would skip exactly the part most likely to be wrong.

Every slice that adds a screen adds:

- the populated state
- the empty state, and where applicable the filtered-empty state
- the error state
- each mutation, asserting that the affected lists refetch
- form validation feedback

Two things get tested with particular care, because they fail quietly:
currency conversion in both directions, and cache invalidation after a mutation.

### What is not tested

No end-to-end browser suite. With one developer and a well-covered API plus
MSW-backed interface tests, the marginal bug caught does not justify the setup
and the flakiness. If the project grows past this point, that decision should be
revisited.

## Working process

Each slice follows the same loop:

1. Write the slice's plan to `docs/plans/slice-N-<name>.md`, with bite-sized TDD
   tasks. Written immediately before execution, not months ahead, so it
   describes the code that actually exists.
2. Branch from `main` as `feat/slice-N-<name>`.
3. Execute task by task. Each task: failing test, run it, minimal
   implementation, run it again, commit.
4. Open a pull request covering the whole slice.
5. Review against the definition of done above.
6. Merge to `main`.

**Commits** follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`,
`chore:`) and are frequent — one per task, not one per slice. A commit message
explains why the change was needed; the diff already shows what changed.

**Pull requests** carry one slice each, spanning both applications. A backend PR
merged without its frontend leaves an API nobody calls, and neither half can be
reviewed for whether it actually works.

## Documents

```
docs/
├── specs/
│   ├── backend.md      what the API does
│   └── frontend.md     what the interface does
└── plans/
    ├── roadmap.md      this document
    └── slice-N-*.md    one per slice, written just before executing it
```

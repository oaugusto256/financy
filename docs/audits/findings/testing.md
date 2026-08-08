# Testing findings

**Agent:** testing
**Baseline:** `main` at `4348600`
**Date:** 2026-08-07

Every finding below uses the record from `_TEMPLATE.md`. Fields are
mandatory. A finding missing `evidence` must set `confidence: hypothesis`.

## Baseline

`rtk proxy "npm test"` from the repo root, run twice, gives a consistent
green suite:

```
backend:  Test Files  26 passed (26)   Tests  276 passed (276)
frontend: Test Files  51 passed (51)   Tests  324 passed (324)
```

No failures, no skips. Every finding below assumes this is a true reading —
it is what the rest of this audit builds on.

---

## test-01 — An unexpected resolver throw is recorded nowhere but the client's own response

- **severity:** high
- **confidence:** verified
- **evidence:**
  - `backend/src/app.ts:16` — `new ApolloServer<GraphQLContext>({ typeDefs, resolvers })`. No `formatError`, no `logger`, no `plugins`. Nothing observes an error before it leaves the process.
  - `backend/src/server.ts:7` — the only `console.*` call anywhere under `backend/src` (`grep -rn "console\.\|winston\|pino\|logger" backend/src` outside `.test.ts` returns this single line). There is no logging library in the dependency tree and no per-request log line — not even the operation name.
  - `node_modules/@apollo/server/dist/cjs/ApolloServer.js:59-61,121` — `includeStacktraceInErrorResponses` defaults to `config.includeStacktraceInErrorResponses ?? (nodeEnv !== 'production' && nodeEnv !== 'test')`, where `nodeEnv = config.nodeEnv ?? process.env.NODE_ENV ?? ''`. `createApp()` sets neither `nodeEnv` nor `includeStacktraceInErrorResponses`, so this reads the **raw** `process.env.NODE_ENV` — not the app's own zod-validated `env.NODE_ENV` from `backend/src/shared/env.ts:8-10`, which defaults to `'development'` and is never cross-checked against the process's actual `NODE_ENV`.
  - `backend/.env.example:5` ships `NODE_ENV=development`. A deploy that copies this file and forgets to override `NODE_ENV=production` in the real process environment gets full stack traces in every GraphQL error response.
  - `node_modules/@apollo/server/dist/cjs/errorNormalize.js:44-47` — even when `includeStacktraceInErrorResponses` is correctly `false`, `enrichError` still spreads `graphqlError.toJSON()`, which always includes the thrown error's `message`. An unhandled Prisma error's message reaches the client either way.
  - `grep -rn "stacktrace\|includeStacktrace" backend/tests` — no matches. Nothing in the suite exercises what an unexpected (non-`GraphQLError`) throw produces.
- **cost:** Today, if a resolver throws anything Prisma or Node itself raises (not one of `shared/errors.ts`'s deliberate `GraphQLError`s), two things happen simultaneously: (1) the *only* record of the failure is the HTTP response sent back to whichever client triggered it — nothing is written anywhere the owner can read after the fact, so a production incident cannot be reconstructed: not which user, not which operation, not which arguments, not even that it happened; (2) unless the deploy environment happens to have `NODE_ENV=production` set at the OS/process level (never enforced or tested), the response includes a full stack trace, which can include file paths and, depending on the error, fragments of query parameters or data.
- **fix:** Add a minimal request/error logger (even a `console.error` in a `formatError` hook, or an Apollo plugin's `didEncounterErrors`) that records the operation name, `context.userId`, and the error, gated by nothing (always log server-side). Pass `includeStacktraceInErrorResponses: env.NODE_ENV === 'production' ? false : true` explicitly into `ApolloServer`'s config so it is driven by the same validated `env` the rest of the app uses, not a second, unvalidated read of `process.env`. Add a test that asserts an unexpected throw does not leak a stack trace when `env.NODE_ENV === 'production'`. Effort: S–M (app.ts plus a small errors/logging module, 1–2 files).

---

## test-02 — No React error boundary; a render-time throw blanks the screen with nothing recorded

- **severity:** high
- **confidence:** verified
- **evidence:**
  - `frontend/src/App.tsx:16-28` — the component tree is `QueryClientProvider > ToastProvider > BrowserRouter > SessionProvider > AppRoutes`. No `ErrorBoundary`.
  - `frontend/src/routes.tsx:32-53` — no boundary wraps any `<Route>` either.
  - `grep -rln "ErrorBoundary\|componentDidCatch\|error-boundary" frontend/src` — zero matches anywhere in the frontend source tree.
- **cost:** React unmounts the entire tree on an uncaught render-time exception. With no boundary, any single component bug — a `null` dereference on a field the mocks always populate but a real (or future) API response might omit, for instance — takes the whole app to a blank white page for that user, with no fallback UI and no report sent anywhere. Nothing in the current test suite would catch this regression either, since `renderWithProviders` never asserts "a boundary catches this" — see also test-03, which is exactly the kind of drift (server returns a shape the frontend didn't expect) that a missing field or unexpected null would trigger with no safety net.
- **fix:** Add a top-level `ErrorBoundary` (React's own `class` API, or a small library) around `<AppRoutes />` in `App.tsx`, rendering a "algo deu errado" fallback, and report the caught error somewhere (even `console.error` today, a real reporter later). Add one test that a thrown render error is caught and the fallback renders instead of nothing. Effort: S (1 new component, 1 file edited).

---

## test-03 — MSW fixtures are never checked against the schema; 105 call sites, zero using the generated types

- **severity:** high
- **confidence:** verified
- **evidence:**
  - `node_modules/msw/lib/core/graphql.d.ts:8-13` — `GraphQLRequestHandler` is generic over `Query`/`Variables`, defaulting to the untyped `GraphQLQuery`/`GraphQLVariables` when no type argument is supplied at the call site.
  - `grep -rn "api\.\(query\|mutation\)<" frontend/src` — 0 matches. `grep -rn "api\.\(query\|mutation\)(" frontend/src | wc -l` — 105 matches, every one of them called without a generic, e.g. `frontend/src/features/auth/LoginPage.test.tsx:21` (`api.mutation('SignIn', () => ok({...}))`) or `frontend/src/features/dashboard/CategoriesPanel.test.tsx:22` (`api.query('Categories', () => ok({ categories }))` where `categories` is typed `unknown[]`).
  - The generated, schema-accurate types exist and are unused for this purpose: `frontend/src/graphql/generated/graphql.ts:228,234,239` exports `MeQuery`/`MeQueryVariables` (and the equivalent for every other operation), which none of the 105 call sites reference.
  - `rtk proxy "npm run codegen:check -w @financy/frontend"` passes — but codegen only diffs `src/graphql/generated` against `graphql/operations/*.graphql`, i.e. the real queries. It never looks at `src/test/msw/api.ts` or any `*.test.tsx` file, so it provides zero protection for the mocks.
- **cost:** As read today, every mocked response happens to match `backend/schema.graphql` (confirmed by manual comparison against `frontend/src/graphql/operations/{auth,categories,transactions,summary}.graphql` during this audit — no live mismatch was found). But nothing enforces that going forward: renaming a field, changing a nullability, or renaming an enum value in `schema.graphql` would not fail `typecheck`, `lint`, or `codegen:check` on the test side — the mocks would keep returning the old shape, the tests would keep passing, and the 324 green frontend tests would be certifying a server response the real backend can no longer produce. The only way to catch that today is the manual side-by-side reading this audit had to do.
- **fix:** Type every `api.query`/`api.mutation` call with its generated operation type, e.g. `api.query<MeQuery, MeQueryVariables>('Me', () => ok({ me: aUser }))`. This is mechanical but touches all 105 call sites plus the `ok`/`graphqlError` helpers in `frontend/src/test/msw/api.ts:10-14`, which would need their generic bound tightened to actually enforce the shape (currently `T extends Record<string, unknown>` accepts anything). Effort: L (mechanical but touches every test file with an MSW handler — a codemod is the realistic path, not manual edits).

---

## test-04 — `/health` has two independent hardcoded-"ok" implementations, neither checks the database, and the one a load balancer would actually hit has no test at all

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - `backend/src/app.ts:33-35` — `app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });`. Unconditional; no Prisma call, no dependency check.
  - `backend/src/schema.ts:18,40` — a second, separate health surface: GraphQL `Query.health: String!` resolved by `health: () => 'ok'`, also unconditional.
  - `backend/tests/integration/health.test.ts:20-27` — the only test file with "health" in its name posts `{ query: '{ health }' }` to `/graphql`. `grep -rn "'/health'" backend/tests backend/src` finds only the route definition in `app.ts` — nothing in the test suite ever issues `GET /health`.
- **cost:** Whatever actually monitors this service in production most plausibly polls the REST route (`GET /health`, the conventional path), not the GraphQL query — and that route is both untested and always returns 200 regardless of whether SQLite is reachable, migrations are current, or the process can serve a real request. A database outage that leaves every real query and mutation failing would still show green on `/health`, and no test in the repo would catch a regression to `/health` either way (it isn't exercised at all).
- **fix:** Make `/health` (and/or `Query.health`) actually probe the database, e.g. `await prisma.$queryRaw\`SELECT 1\`` (the same call `backend/tests/integration/prisma.test.ts` already uses to prove connectivity), returning 503 on failure. Add a `supertest` test hitting `GET /health` for both the healthy and (with a closed/broken connection) unhealthy case. Effort: S (app.ts plus one new or extended test file).

---

## test-05 — Cache invalidation after an *update* is asserted for its mutation variables but never for its refetch, in both CategoryDialog and TransactionDialog

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - `frontend/src/features/categories/CategoriesPage.test.tsx` has `'creates a category and refetches both lists'` (line 172) and `'deletes from a card and refetches'` (line 352) — both assert the new/removed row actually appears/disappears after the mutation. There is no equivalent `'edits a category and refetches'` test anywhere in that file or in `frontend/src/features/categories/CategoryDialog.test.tsx`; the two edit-path tests there (`'sends the id when editing'` line 74, `'sends a cleared description as null...'` line 100) only assert the **variables** passed to `UpdateCategory`, never that `Categories`/`CategoryStats` re-render with the edited data.
  - `frontend/src/features/transactions/TransactionDialog.test.tsx` — the `'TransactionDialog, creating'` describe block has `'refetches every list the new row changed'` (line 135). The `'TransactionDialog, editing'` describe block (line 226) has only two tests, `'opens holding the current values'` and `'sends only an update'` (line 251) — the latter again only checks `variables`, never a refetch.
  - The invalidation code path is shared, not duplicated per-branch: `frontend/src/features/categories/CategoryDialog.tsx:58-65` defines one `invalidate()` used by both the create and update branches of `onSubmit`; same pattern in `TransactionDialog.tsx:91-101`.
- **cost:** Because the invalidation helper is shared today, the update path is very likely correct in practice — but nothing in the suite would notice if it stopped being shared. A future edit that special-cased "only invalidate on create" (a plausible copy-paste slip when someone adds an update-specific side effect) would ship with all 324 frontend tests green: an edited category's new name, or an edited transaction's new amount/date, would keep showing the pre-edit values on the list/dashboard until an unrelated navigation or refetch happened to reload it — exactly the "stale data on screen" failure mode the audit brief calls out, and exactly the one case (of three: create/update/delete) with no behavioral test.
- **fix:** Add one test per dialog mirroring the existing create/delete refetch tests: mock `UpdateCategory`/`UpdateTransaction` to succeed, then assert the edited value appears in the refetched `Categories`/`Transactions` list, the way `CategoriesPage.test.tsx:172-209` already does for create. Effort: S (2 test files, no source changes).

---

## test-06 — One integration test re-proves a rule the unit suite already pins, at full database cost, for a reason the unit test cannot supply

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `backend/tests/unit/category-validation.test.ts:62` — `'rejects an icon outside the sixteen tokens'` already unit-pins that an invalid `icon` fails validation, with no database involved.
  - `backend/tests/integration/category-service.test.ts:69-75` — `'rejects invalid input before touching the database'` sends the same kind of invalid `icon` through `createCategoryService`, inside a `beforeEach(resetDatabase)` file that also does `migrate deploy` at `globalSetup` (`backend/tests/setup/global-setup.ts:9`) and runs serially because of `fileParallelism: false` (`backend/vitest.config.ts:9`).
- **cost:** Low — this specific integration test does add value the unit test cannot (`expect(await prisma.category.count()).toBe(0)`, proving validation short-circuits before any write), so it is not pure duplication. Flagged at low severity because it is the one clear instance in the suite where the same business rule is pinned twice at very different cost, worth knowing about if the DB-backed suite's runtime ever becomes a problem — the fix is to keep the "count stays 0" assertion but not re-assert the enum rule itself here, since `category-validation.test.ts` already owns that.
- **fix:** Trim the integration test's assertion to the DB-specific claim (row count unchanged) and drop the enum-specific expectation, or leave as-is if the redundancy is considered cheap insurance. Effort: S, optional.

---

## Checklist items answered without a finding

- **MSW strictness (item 3):** confirmed — `frontend/src/test/setup.ts:21` sets `server.listen({ onUnhandledRequest: 'error' })`, and multiple tests rely on it as their assertion (e.g. `LoginPage.test.tsx:88-97`, `DeleteCategoryDialog.test.tsx:46-56`).
- **Test isolation (item 6):** backend integration tests share one `test.db` (`backend/tests/setup/global-setup.ts:3,9`), each file resets it in `beforeEach(resetDatabase)` (`backend/tests/helpers/db.ts:4-10`), and `backend/vitest.config.ts:9` sets `fileParallelism: false` specifically because of this — the config is honest about the constraint and enforces it; no order-dependent gap was found.
- **Timezone dependence (item 7):** the frontend's `TZ=America/Sao_Paulo` pin (`frontend/package.json:9-10`) is load-bearing for `frontend/src/lib/period.test.ts` (hardcoded `...T03:00:00.000Z` boundaries) and for the ISO-string assertions in `TransactionsPage.test.tsx` and `DashboardPage.test.tsx`. The backend has no equivalent pin and needs none: `backend/src/modules/summary/service.ts:31-36` deliberately windows months in UTC via `Date.UTC`, and every backend test that touches month boundaries (`transaction-filter.test.ts`, `summary.test.ts`) constructs dates with `Date.UTC` too — no backend test was found with an un-pinned local-time dependency.

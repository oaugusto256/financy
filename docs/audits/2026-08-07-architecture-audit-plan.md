# Architecture and Gaps Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a single ranked, evidence-backed findings table for the financy monorepo, then fix only the findings the owner approves.

**Architecture:** Four read-only agents run in parallel, one per audit domain, each writing exactly one findings file under `docs/audits/findings/`. The main thread merges, deduplicates and ranks them into one table. The owner triages that table. Only then does any source file change.

**Tech Stack:** npm workspaces monorepo. Backend: Express 4, Apollo Server 4, Prisma 6, SQLite, zod 4, jose, `@node-rs/argon2`, vitest. Frontend: React 19, Vite 8, TanStack Query 5, Tailwind 4, react-hook-form, MSW 2, vitest + jsdom.

**Design doc:** `docs/audits/2026-08-07-architecture-audit-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Baseline is `main` at `4348600`.** Work happens on branch `chore/architecture-audit`, never on `main`.
- **Run anything cited as evidence through `rtk proxy "<cmd>"`.** The RTK hook filters output and has reported a pass for a command that failed, and a stale SHA for a `git log`. A claim from a filtered run is not verified.
- **`rtk proxy` cannot take a `-C` flag.** `rtk proxy "git -C <path> status"` fails with ``error: unknown switch `C'``. Run commands from the repo root instead.
- **Audit agents may not edit source.** Each may write exactly one file, its own findings file. No source, config, spec or plan file changes during Tasks 2–5.
- **Every finding carries a `file:line` citation**, or is tagged `confidence: hypothesis` and ranked below every verified finding.
- **Anti-boilerplate.** A finding must name a cost observed in this repository. "Monorepos should have CI" is inadmissible; "no CI, and two slice-2 tasks were sent back for skipping `format:check`" is admissible. Tool adoption recommendations (Turborepo, Nx, Docker, monitoring vendors) are admissible only after the finding establishes the concrete problem the tool solves here.
- **Interface language is Brazilian Portuguese. Code, comments, commit messages and PR descriptions are English.**
- **Conventional Commits, one commit per task.**
- **No `any`** — lint rejects it outside `generated/`.
- **Pinned majors, do not let an install drift them:** `prisma` and `@prisma/client` `^6`, `@apollo/server` `^4`, `express` and `@types/express` `^4`.
- **The gate** is `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, plus `npm run codegen:check -w @financy/backend` and `npm run codegen:check -w @financy/frontend`. There is no CI; every green claim comes from a local run.
- **`backend/schema.graphql` is generated, committed, and in `.prettierignore`.** Do not format it.

---

## File Structure

| Path | Created by | Responsibility |
|---|---|---|
| `docs/audits/findings/_TEMPLATE.md` | Task 1 | The one finding record format all four agents fill in |
| `docs/audits/findings/architecture.md` | Task 2 | Architecture and boundaries findings |
| `docs/audits/findings/security.md` | Task 3 | Security and data integrity findings |
| `docs/audits/findings/tooling.md` | Task 4 | Tooling and repo hygiene findings |
| `docs/audits/findings/testing.md` | Task 5 | Testing and observability findings |
| `docs/audits/2026-08-07-findings.md` | Task 6 | The merged, deduplicated, ranked table the owner triages |

Tasks 2–5 have no dependency on each other and are dispatched in a single message. Task 6 consumes all four.

---

### Task 1: Findings directory and record template

**Files:**
- Create: `docs/audits/findings/_TEMPLATE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the finding record format that Tasks 2–5 copy verbatim, and that Task 6 parses.

- [ ] **Step 1: Write the template**

Create `docs/audits/findings/_TEMPLATE.md` with exactly this content:

````markdown
# <Domain> findings

**Agent:** <domain>
**Baseline:** `main` at `4348600`
**Date:** 2026-08-07

Every finding below uses this record. Fields are mandatory. A finding missing
`evidence` must set `confidence: hypothesis`.

---

## <domain>-01 — <one-line title>

- **severity:** high | medium | low
- **confidence:** verified | hypothesis
- **evidence:**
  - `path/to/file.ts:42` — what is on that line and why it matters
  - command: `rtk proxy "npm run lint"` → paste the relevant output lines
- **cost:** What this breaks now, or what it will break, concretely. Not "this
  is bad practice" — name the failure.
- **fix:** Sketch of the change. Which files. Effort: S (< 1 file, mechanical) |
  M (2–3 files) | L (4+ files, or changes a public contract).

---
````

- [ ] **Step 2: Verify prettier accepts it**

Run: `rtk proxy "npx prettier --check docs/audits/findings/_TEMPLATE.md"`
Expected: `All matched files use Prettier code style!`

If it fails, run `rtk proxy "npx prettier --write docs/audits/findings/_TEMPLATE.md"` and re-check.

- [ ] **Step 3: Commit**

```bash
git add docs/audits/findings/_TEMPLATE.md
git commit -m "docs: add the audit finding record template"
```

---

### Task 2: Architecture and boundaries audit

**Files:**
- Create: `docs/audits/findings/architecture.md`

**Interfaces:**
- Consumes: `docs/audits/findings/_TEMPLATE.md` from Task 1.
- Produces: findings with ids `arch-01`, `arch-02`, … consumed by Task 6.

- [ ] **Step 1: Dispatch the agent**

Use the Agent tool, `subagent_type: "general-purpose"`, with this prompt verbatim:

> You are auditing the `financy` npm-workspaces monorepo at
> `/Users/otavioaugusto/projects/financy`, on branch `chore/architecture-audit`,
> baseline `main` at `4348600`. Your domain is **architecture and boundaries**.
>
> **You may write exactly one file: `docs/audits/findings/architecture.md`.**
> You may not edit any other file — no source, no config, no specs. If you spot
> a fix, record it as a finding; do not apply it.
>
> Read `docs/audits/findings/_TEMPLATE.md` first and use that record format for
> every finding, with ids `arch-01`, `arch-02`, and so on.
>
> Rules:
> - Every finding needs a `file:line` citation, or it must be tagged
>   `confidence: hypothesis`.
> - Any claim resting on command output must run the command as
>   `rtk proxy "<cmd>"` from the repo root. The plain command is filtered by a
>   hook that has previously reported a pass for a command that failed. Note
>   that `rtk proxy` cannot take a `-C` flag.
> - A finding must name a cost observed in this repository. "Monorepos should
>   have a shared package" is inadmissible. "Signup password minimum is 8 in
>   the backend and 6 in the frontend, so the client accepts a password the
>   server rejects" is admissible.
>
> Work this checklist. Each item is a question to answer with evidence, not a
> conclusion to confirm. Several may turn out to be non-issues — say so
> explicitly rather than manufacturing a finding.
>
> 1. **Validation duplication.** Compare the zod schemas in
>    `backend/src/modules/auth/validation.ts`,
>    `backend/src/modules/category/validation.ts`,
>    `backend/src/modules/transaction/validation.ts` and
>    `backend/src/modules/summary/validation.ts` against
>    `frontend/src/features/auth/validation.ts`,
>    `frontend/src/features/categories/validation.ts` and
>    `frontend/src/features/transactions/validation.ts`. For each shared field,
>    do the constraints agree — min, max, regex, optionality? Where they
>    disagree, state which side is stricter and what the user sees.
> 2. **Resolver/service layering.** Does any file under
>    `backend/src/modules/*/resolvers.ts` call Prisma directly rather than going
>    through its `service.ts`? Grep for `prisma.` inside the resolver files.
> 3. **Cross-module coupling.** Does any `backend/src/modules/<a>/service.ts`
>    import from `backend/src/modules/<b>/`? Map every cross-module import and
>    say whether the direction is defensible.
> 4. **Module registration.** Read `backend/src/schema.ts` and
>    `backend/src/context.ts`. How many files must be edited to add a fifth
>    module? If it is more than two, list them.
> 5. **Frontend feature coupling.** Does any file under
>    `frontend/src/features/<a>/` import from `frontend/src/features/<b>/`?
>    `dashboard` importing from `transactions` or `categories` is the likely
>    case. Map them and judge whether the shared thing belongs in
>    `components/` or `lib/` instead.
> 6. **`lib/` direction.** Does anything under `frontend/src/lib/` import from
>    `frontend/src/features/` or `frontend/src/components/`? That is an
>    inverted dependency.
> 7. **Error contract.** Compare `backend/src/shared/errors.ts` with
>    `frontend/src/lib/graphql-errors.ts`. The error codes are a contract
>    across the workspace boundary. Is there one definition, or two that can
>    drift? If two, is every backend code handled on the frontend?
> 8. **Shared code.** Commit `5db5bfb` dropped an empty `packages/` directory,
>    so there is no shared workspace package. Each workspace runs its own
>    graphql-codegen against the same schema. Identify what is genuinely
>    duplicated across the boundary today — types, enums, constants, validation
>    rules — and what it would cost to keep them aligned by hand.
> 9. **File size.** List every `.ts`/`.tsx` file under `backend/src` or
>    `frontend/src`, excluding `generated/`, over 250 lines. For each, say what
>    distinct responsibilities it holds.
> 10. **Spec drift.** Spot-check `docs/specs/backend.md` and
>     `docs/specs/frontend.md` against the code for the module boundaries they
>     describe. Section 12 of `frontend.md` records deliberate deviations —
>     anything listed there is not a finding. Where spec and code disagree,
>     state which side is wrong.
>
> Finish by writing `docs/audits/findings/architecture.md`. Order findings by
> severity, highest first. In your final report to me, give only the finding
> ids with their one-line titles and severities — I will read the file.

- [ ] **Step 2: Verify the agent stayed read-only**

Run: `rtk proxy "git status --short"`
Expected: exactly one untracked path, `docs/audits/findings/architecture.md`. If any other file is modified, revert it with `rtk proxy "git checkout -- <path>"` and note the violation.

- [ ] **Step 3: Commit**

```bash
git add docs/audits/findings/architecture.md
git commit -m "docs: record the architecture and boundaries audit findings"
```

---

### Task 3: Security and data integrity audit

**Files:**
- Create: `docs/audits/findings/security.md`

**Interfaces:**
- Consumes: `docs/audits/findings/_TEMPLATE.md` from Task 1.
- Produces: findings with ids `sec-01`, `sec-02`, … consumed by Task 6.

- [ ] **Step 1: Dispatch the agent**

Use the Agent tool, `subagent_type: "general-purpose"`, with this prompt verbatim:

> You are auditing the `financy` npm-workspaces monorepo at
> `/Users/otavioaugusto/projects/financy`, on branch `chore/architecture-audit`,
> baseline `main` at `4348600`. Your domain is **security and data integrity**.
> This is a defensive review of a personal-finance app the owner controls.
>
> **You may write exactly one file: `docs/audits/findings/security.md`.**
> You may not edit any other file — no source, no config, no specs. If you spot
> a fix, record it as a finding; do not apply it.
>
> Read `docs/audits/findings/_TEMPLATE.md` first and use that record format for
> every finding, with ids `sec-01`, `sec-02`, and so on.
>
> Rules:
> - Every finding needs a `file:line` citation, or it must be tagged
>   `confidence: hypothesis`.
> - Any claim resting on command output must run the command as
>   `rtk proxy "<cmd>"` from the repo root. The plain command is filtered by a
>   hook that has previously reported a pass for a command that failed. Note
>   that `rtk proxy` cannot take a `-C` flag.
> - Do not report a theoretical vulnerability without showing the code path
>   that reaches it. Name the request an attacker would send.
>
> Work this checklist. Each item is a question to answer with evidence.
>
> 1. **Per-user scoping.** The project's definition of done requires every query
>    and mutation to filter by the calling user **in the where clause**.
>    Enumerate every Prisma call in `backend/src/modules/category/service.ts`,
>    `backend/src/modules/transaction/service.ts` and
>    `backend/src/modules/summary/service.ts`. For each, state whether `userId`
>    is in the `where`, or whether ownership is checked after the fetch — or not
>    at all. An `update`/`delete` by `id` alone is a cross-user write.
> 2. **Cross-user tests.** For each operation found in item 1, find the test in
>    `backend/tests/integration/` that asserts a second user gets `NOT_FOUND`.
>    List every operation that has no such test. A missing test is a finding
>    even when the code is correct.
> 3. **DataLoader scoping.** `backend/src/shared/dataloaders.ts` is built per
>    request in `createContext`, capturing `userId`. Verify no loader instance
>    can outlive a request or be shared between requests, and that the batch
>    function itself filters by the captured `userId` rather than trusting the
>    key.
> 4. **JWT.** Read `backend/src/shared/jwt.ts`. Which algorithm is used? Is the
>    algorithm pinned on *verification* (not only on signing)? Is there an
>    expiry, and what is it? Is the secret length-checked before use? Is the
>    issuer/audience checked?
> 5. **Secret and env handling.** Read `backend/src/shared/env.ts` and
>    `backend/.env.example`. Is every variable the code reads validated at boot
>    with a real constraint, or merely read? Does a weak or missing JWT secret
>    fail startup or silently pass? Is every variable in the code present in
>    `.env.example`?
> 6. **Password hashing.** Read `backend/src/shared/password.ts`. Which argon2
>    variant and parameters? Is the comparison constant-time? Does signup or
>    login leak whether an email exists, through a different error or a
>    measurably different response time?
> 7. **Rate limiting.** Search the backend for any rate limiting on the login
>    and signup mutations. If there is none, state the concrete attack — an
>    unthrottled credential-stuffing loop against `POST /graphql` — and check
>    whether anything else (proxy, Apollo config) bounds it.
> 8. **Token storage.** Read `frontend/src/lib/token-storage.ts` and
>    `frontend/src/lib/graphql-client.ts`. Where does the JWT live? State the
>    exposure honestly, including the tradeoff — this is a SPA against a
>    separate origin, so the alternatives have their own costs. Do not
>    recommend a change without naming what it breaks.
> 9. **CORS and transport.** Read `backend/src/app.ts`. What origins does CORS
>    allow, and is that value environment-driven or hardcoded? Are credentials
>    allowed?
> 10. **GraphQL surface.** In `backend/src/app.ts` and `backend/src/server.ts`:
>     is introspection enabled unconditionally? Is there any query depth,
>     complexity or alias limit? Does the error formatter strip stack traces and
>     internal messages before they reach the client, or does a Prisma error
>     reach the wire intact?
> 11. **Money representation.** `backend/prisma/schema.prisma:39` stores
>     `amount` as `Int // cents`. Verify nothing converts it to a float and back
>     — check `backend/src/modules/summary/service.ts`,
>     `frontend/src/lib/currency.ts` and every call site that formats or sums an
>     amount. A rounding path that loses a cent is a finding.
> 12. **Migration drift.** There are two migrations under
>     `backend/prisma/migrations/`. Verify they reconcile with the current
>     `backend/prisma/schema.prisma` — in particular the `@@unique([userId, name])`
>     and the `@@index` declarations at `schema.prisma:33-34` and
>     `schema.prisma:50-51`. Run
>     `rtk proxy "npx prisma migrate diff --from-migrations backend/prisma/migrations --to-schema-datamodel backend/prisma/schema.prisma --shadow-database-url file:./shadow.db --exit-code"`
>     from the repo root and report the result. Delete any shadow database file
>     the command leaves behind.
> 13. **Input validation reaching Prisma.** Confirm that every mutation runs its
>     zod schema before the first Prisma call, not after. Name any path where
>     unvalidated input reaches the database.
>
> Finish by writing `docs/audits/findings/security.md`. Order findings by
> severity, highest first. In your final report to me, give only the finding
> ids with their one-line titles and severities — I will read the file.

- [ ] **Step 2: Verify the agent stayed read-only**

Run: `rtk proxy "git status --short"`
Expected: exactly one untracked path, `docs/audits/findings/security.md`. A stray `shadow.db` from item 12 must be deleted. If any tracked file is modified, revert it with `rtk proxy "git checkout -- <path>"` and note the violation.

- [ ] **Step 3: Commit**

```bash
git add docs/audits/findings/security.md
git commit -m "docs: record the security and data integrity audit findings"
```

---

### Task 4: Tooling and repo hygiene audit

**Files:**
- Create: `docs/audits/findings/tooling.md`

**Interfaces:**
- Consumes: `docs/audits/findings/_TEMPLATE.md` from Task 1.
- Produces: findings with ids `tool-01`, `tool-02`, … consumed by Task 6.

- [ ] **Step 1: Dispatch the agent**

Use the Agent tool, `subagent_type: "general-purpose"`, with this prompt verbatim:

> You are auditing the `financy` npm-workspaces monorepo at
> `/Users/otavioaugusto/projects/financy`, on branch `chore/architecture-audit`,
> baseline `main` at `4348600`. Your domain is **tooling and repo hygiene**.
>
> **You may write exactly one file: `docs/audits/findings/tooling.md`.**
> You may not edit any other file — no source, no config, no specs. If you spot
> a fix, record it as a finding; do not apply it.
>
> Read `docs/audits/findings/_TEMPLATE.md` first and use that record format for
> every finding, with ids `tool-01`, `tool-02`, and so on.
>
> Rules:
> - Every finding needs a `file:line` citation, or it must be tagged
>   `confidence: hypothesis`.
> - Any claim resting on command output must run the command as
>   `rtk proxy "<cmd>"` from the repo root. The plain command is filtered by a
>   hook that has previously reported a pass for a command that failed. Note
>   that `rtk proxy` cannot take a `-C` flag.
> - **This domain attracts boilerplate. Guard against it.** A finding must name
>   a cost observed in this repository. Do not recommend Turborepo, Nx, Docker,
>   changesets, or a monitoring vendor unless you first establish the concrete
>   problem it solves here, with evidence.
>
> Work this checklist. Each item is a question to answer with evidence.
>
> 1. **The gate is manual.** Confirm there is no `.github/` directory and no
>    other CI config. The observed cost is on record: `CLAUDE.md` states two
>    slice-2 tasks were sent back for skipping `format:check`. Verify that
>    statement against `git log`, and state what else has shipped without the
>    gate running. This is the single highest-leverage tooling finding if it
>    holds — treat it seriously, not as a checkbox.
> 2. **No pre-commit hook.** Confirm there is no husky, lint-staged, simple-git-hooks
>    or `.git/hooks` customization. Combined with item 1, nothing mechanical
>    stops a broken commit.
> 3. **The gate is not one command.** The root `package.json` has `test`,
>    `typecheck`, `lint` and `format:check`, but no aggregate `codegen:check` —
>    that must be run once per workspace by hand
>    (`backend/package.json:13`, `frontend/package.json:13`). Verify, and state
>    what a reviewer must remember that a script could remember for them.
> 4. **Node version is unpinned.** The root `package.json` declares
>    `engines.node: ">=20"` with no `.nvmrc` or `.tool-versions`. Check whether
>    anything in the toolchain actually requires a narrower range — Vite 8 and
>    the `--env-file-if-exists` flag used in `backend/package.json:6` are the
>    candidates.
> 5. **Pinned majors.** `CLAUDE.md` pins `prisma`/`@prisma/client` at `^6`,
>    `@apollo/server` at `^4`, `express`/`@types/express` at `^4`. Verify the
>    current ranges in both workspace manifests still match, and that nothing in
>    `package-lock.json` has resolved outside them.
> 6. **Duplicated devDependencies.** `typescript`, `vitest` and the
>    graphql-codegen packages are declared separately in both workspaces. List
>    every package declared in both, and flag any where the declared ranges
>    differ — a skew between workspaces means `typecheck` means two different
>    things.
> 7. **Build and start actually work.** Run
>    `rtk proxy "npm run build -w @financy/backend"` and confirm the output path
>    matches `backend/package.json:8` (`node dist/src/server.js`). Then run
>    `rtk proxy "npm run build -w @financy/frontend"`. Report failures verbatim.
>    Clean up any `dist/` the build creates if it is not gitignored — check
>    `.gitignore` first.
> 8. **Ignore coverage.** Read `.gitignore` and `.prettierignore`. Confirm
>    `.env`, the SQLite databases including `test.db`, `dist/` and
>    `*.tsbuildinfo` are ignored, and that `backend/schema.graphql` is in
>    `.prettierignore` — `CLAUDE.md` records that formatting it makes
>    `format:check` and `codegen:check` undo each other.
> 9. **Secret scanning scope.** Read `.gitguardian.yaml`. It exempts
>    `backend/tests/helpers/credentials.ts` and `frontend/src/test/credentials.ts`.
>    Verify no password-shaped literal exists outside those two files.
> 10. **Deployment story.** Check `README.md` and `docs/plans/roadmap.md` for
>     whether deployment is in scope for this project at all. If the roadmap
>     never claims it, the absence of a Dockerfile is not a finding — say so and
>     move on. If the roadmap does claim it, the gap is real.
> 11. **README accuracy.** `README.md` was rewritten as a run-and-review guide
>     in commit `a37647f`. Follow it literally as a new contributor would.
>     Every command it gives that does not work as written is a finding.
>
> Finish by writing `docs/audits/findings/tooling.md`. Order findings by
> severity, highest first. In your final report to me, give only the finding
> ids with their one-line titles and severities — I will read the file.

- [ ] **Step 2: Verify the agent stayed read-only**

Run: `rtk proxy "git status --short"`
Expected: exactly one untracked path, `docs/audits/findings/tooling.md`. Build output from item 7 must be gone or gitignored. If any tracked file is modified, revert it with `rtk proxy "git checkout -- <path>"` and note the violation.

- [ ] **Step 3: Commit**

```bash
git add docs/audits/findings/tooling.md
git commit -m "docs: record the tooling and repo hygiene audit findings"
```

---

### Task 5: Testing and observability audit

**Files:**
- Create: `docs/audits/findings/testing.md`

**Interfaces:**
- Consumes: `docs/audits/findings/_TEMPLATE.md` from Task 1.
- Produces: findings with ids `test-01`, `test-02`, … consumed by Task 6.

- [ ] **Step 1: Dispatch the agent**

Use the Agent tool, `subagent_type: "general-purpose"`, with this prompt verbatim:

> You are auditing the `financy` npm-workspaces monorepo at
> `/Users/otavioaugusto/projects/financy`, on branch `chore/architecture-audit`,
> baseline `main` at `4348600`. Your domain is **testing and observability**.
>
> **You may write exactly one file: `docs/audits/findings/testing.md`.**
> You may not edit any other file — no source, no config, no specs, and no
> tests. If you spot a missing test, record it as a finding; do not write it.
>
> Read `docs/audits/findings/_TEMPLATE.md` first and use that record format for
> every finding, with ids `test-01`, `test-02`, and so on.
>
> Rules:
> - Every finding needs a `file:line` citation, or it must be tagged
>   `confidence: hypothesis`.
> - Any claim resting on command output must run the command as
>   `rtk proxy "<cmd>"` from the repo root. The plain command is filtered by a
>   hook that has previously reported a pass for a command that failed. Note
>   that `rtk proxy` cannot take a `-C` flag.
> - "Coverage is low" is not a finding. "This specific behaviour has no test,
>   and here is the bug that would ship undetected" is.
>
> Work this checklist. Each item is a question to answer with evidence.
>
> 1. **Baseline.** Run `rtk proxy "npm test"` and record the real result — suite
>    counts per workspace, and any failure verbatim. Every later item builds on
>    this being a true reading.
> 2. **MSW drift.** `frontend/src/test/msw/api.ts` hand-writes GraphQL
>    responses. Nothing compares them to `backend/schema.graphql`. For each
>    mocked operation, check the response shape against the real schema —
>    field names, nullability, enum values. Any mock returning a shape the
>    server cannot produce means the frontend tests pass against a fiction.
>    Name each mismatch.
> 3. **MSW strictness.** `frontend/src/test/setup.ts` should set
>    `onUnhandledRequest: 'error'`. Confirm it. Several tests use that as their
>    assertion, so a change to it would silently weaken them.
> 4. **Untested files.** List every `.ts`/`.tsx` under `backend/src` and
>    `frontend/src`, excluding `generated/`, with no corresponding test. For each,
>    say what would break undetected. Rank by consequence, not by count.
> 5. **Pyramid shape.** Count `backend/tests/unit` vs `backend/tests/integration`
>    vs the co-located frontend tests. Where integration tests are being used to
>    cover logic a unit test would pin faster, say which ones and why it matters
>    — every integration test pays the migration and database cost from
>    `backend/tests/setup/global-setup.ts`.
> 6. **Test isolation.** Read `backend/tests/setup/global-setup.ts`,
>    `backend/tests/helpers/db.ts` and `backend/vitest.config.ts`. Do tests share
>    one `test.db`? Can they run in parallel without cross-contamination, and
>    does the config actually force serial execution if they cannot? An
>    order-dependent suite is a finding.
> 7. **Timezone dependence.** Both frontend test scripts pin
>    `TZ=America/Sao_Paulo` (`frontend/package.json:9-10`). Find which tests
>    depend on that, and whether any backend test has the same dependency
>    without the pin. Date-boundary logic in `frontend/src/lib/period.ts` and
>    `backend/prisma/seed-dates.ts` are the candidates.
> 8. **Backend observability.** Search the backend for structured logging. Is
>    there any, or only `console`? When a resolver throws in production, what is
>    recorded, and could the owner reconstruct which user hit which operation?
>    Read the Apollo error formatting in `backend/src/app.ts` for what survives.
> 9. **Frontend error boundary.** Read `frontend/src/App.tsx` and
>    `frontend/src/routes.tsx`. Is there a React error boundary? If not, a
>    render-time throw blanks the page with nothing recorded. Confirm by finding
>    the absence, not by assuming it.
> 10. **Health and readiness.** `backend/tests/integration/health.test.ts`
>     implies a health endpoint. Find it in `backend/src/app.ts`. Does it check
>     anything real, such as database reachability, or does it return 200
>     unconditionally?
> 11. **Query-key correctness.** `frontend/src/graphql/generated/query-keys.test.ts`
>     and `category-keys.test.ts` exist. Determine what invariant they protect,
>     and whether cache invalidation after each mutation is actually tested —
>     a mutation that does not invalidate leaves stale data on screen, which no
>     type check catches.
>
> Finish by writing `docs/audits/findings/testing.md`. Order findings by
> severity, highest first. In your final report to me, give only the finding
> ids with their one-line titles and severities — I will read the file.

- [ ] **Step 2: Verify the agent stayed read-only**

Run: `rtk proxy "git status --short"`
Expected: exactly one untracked path, `docs/audits/findings/testing.md`. If any tracked file is modified, revert it with `rtk proxy "git checkout -- <path>"` and note the violation.

- [ ] **Step 3: Commit**

```bash
git add docs/audits/findings/testing.md
git commit -m "docs: record the testing and observability audit findings"
```

---

### Task 6: Merge, deduplicate and rank

**Files:**
- Create: `docs/audits/2026-08-07-findings.md`
- Read: all four files in `docs/audits/findings/`

**Interfaces:**
- Consumes: `arch-NN`, `sec-NN`, `tool-NN`, `test-NN` records from Tasks 2–5.
- Produces: the ranked table the owner triages in Task 7, whose row ids are reused as commit scopes in Task 8.

This task is done by the main thread, not an agent. No agent has seen another agent's output, so only the main thread can spot the duplicates.

- [ ] **Step 1: Read all four findings files**

Read `docs/audits/findings/architecture.md`, `security.md`, `tooling.md` and `testing.md` in full.

- [ ] **Step 2: Collapse duplicates**

The domains overlap by design. Expect duplicates in these places specifically:

| Overlap | Reported by |
|---|---|
| Prisma calls reached outside `service.ts` — the same call sites both agents read | architecture (item 2) and security (item 1) |
| Missing cross-user tests | security (item 2) and testing (item 4) |
| Cross-boundary contract drift — error codes and mocked response shapes | architecture (item 7) and testing (item 2) |
| Duplicated zod validation, and where it runs relative to Prisma | architecture (item 1) and security (item 13) |
| The manual gate | tooling (items 1–3) and testing (item 1) |

A collapsed row carries the union of the evidence and the **higher** of the two severities. Keep both original ids in a `sources` column so the finding is traceable back to its file.

- [ ] **Step 3: Drop and demote**

- Drop any finding that violates the anti-boilerplate rule — no observed cost named in this repository.
- Demote every `confidence: hypothesis` finding below all verified findings regardless of its claimed severity.

- [ ] **Step 4: Write the ranked table**

Create `docs/audits/2026-08-07-findings.md`. Order by severity descending, then by effort ascending, so the cheapest high-severity work is at the top. Use this structure:

```markdown
# Audit findings — 2026-08-07

**Baseline:** `main` at `4348600`
**Design:** `docs/audits/2026-08-07-architecture-audit-design.md`
**Raw findings:** `docs/audits/findings/`

Triage column is for the owner: `fix`, `skip`, or `later`.

## Verified

| # | Finding | Severity | Effort | Sources | Triage |
|---|---|---|---|---|---|
| 1 | <one line, states the failure not the topic> | high | S | `sec-01`, `arch-04` | |

## Hypotheses — need verification before acting

| # | Finding | Severity | Effort | Sources | Triage |
|---|---|---|---|---|---|

## Detail

### 1. <title>

**Evidence:** ...
**Cost:** ...
**Fix:** ...
```

Every row in a table must have a matching `## Detail` entry. Do not summarise a finding out of existence — the tables are the index, the detail section is the content.

- [ ] **Step 5: Verify formatting**

Run: `rtk proxy "npx prettier --check docs/audits/2026-08-07-findings.md"`
Expected: `All matched files use Prettier code style!`

- [ ] **Step 6: Commit**

```bash
git add docs/audits/2026-08-07-findings.md
git commit -m "docs: merge the audit findings into one ranked table"
```

---

### Task 7: Triage gate

**Files:** none changed by an agent.

**Interfaces:**
- Consumes: `docs/audits/2026-08-07-findings.md` from Task 6.
- Produces: a filled Triage column, which decides the scope of Task 8.

**This task stops and waits for the owner. Nothing is fixed before it completes.**

- [ ] **Step 1: Present the table**

Report to the owner: the count of verified findings by severity, the top five rows in full, and any hypothesis that would change the ranking if it were confirmed.

- [ ] **Step 2: Collect the decisions**

The owner marks each row `fix`, `skip` or `later`. Record the decisions in the Triage column of `docs/audits/2026-08-07-findings.md`.

- [ ] **Step 3: Split by size**

Any row marked `fix` whose effort is **L** — 4+ files, or a change to a public contract — does not go into Task 8. It gets its own design and plan, because a large architectural change deserves its own review. List those rows separately and confirm with the owner before proceeding.

- [ ] **Step 4: Commit the triage decisions**

```bash
git add docs/audits/2026-08-07-findings.md
git commit -m "docs: record the audit triage decisions"
```

---

### Task 8: Fix loop — repeat once per approved finding

**Files:** determined per finding by its `fix` field.

**Interfaces:**
- Consumes: the rows marked `fix` with effort S or M from Task 7.
- Produces: one commit per finding on `chore/architecture-audit`.

Run these five steps for each approved finding, in the table's order. Do not batch two findings into one commit — a commit the owner wants reverted must be revertible alone.

- [ ] **Step 1: Re-read the finding**

Open its `## Detail` entry in `docs/audits/2026-08-07-findings.md`. Confirm the evidence still holds against the current working tree — an earlier fix in this loop may have already changed it. If it no longer holds, mark the row `superseded` and move to the next finding.

- [ ] **Step 2: Write the failing test**

Every fix that changes behaviour starts with a test that fails for the reason the finding describes. Backend tests go in `backend/tests/unit/` or `backend/tests/integration/`; frontend tests sit beside the file under test.

Findings that change no behaviour — a missing `.nvmrc`, a `.gitignore` entry, a spec correction — have no test. Skip to Step 4 and say so in the commit body.

- [ ] **Step 3: Run it and confirm it fails for the right reason**

Run: `rtk proxy "npm test -w @financy/backend"` or `rtk proxy "npm test -w @financy/frontend"`

Expected: FAIL, with a message that matches the finding's `cost`. A test that fails for an unrelated reason is not evidence of the bug.

- [ ] **Step 4: Apply the minimal fix**

Change only what the finding names. A fix that improves neighbouring code is a separate finding and a separate commit.

If the fix corrects the implementation and the spec described the old behaviour correctly, the spec is right and the code was wrong. If the spec described behaviour the code never had, correct `docs/specs/backend.md` or `docs/specs/frontend.md` **in the same commit** — that is required by the project's definition of done.

- [ ] **Step 5: Run the full gate**

Run each of these, from the repo root, and read the real output:

```bash
rtk proxy "npm test"
rtk proxy "npm run typecheck"
rtk proxy "npm run lint"
rtk proxy "npm run format:check"
rtk proxy "npm run codegen:check -w @financy/backend"
rtk proxy "npm run codegen:check -w @financy/frontend"
```

Expected: all six pass, and both `codegen:check` runs report no diff. Nothing runs these on push, so this local run is the only gate that exists. Do not commit on a partial pass.

- [ ] **Step 6: Commit**

One commit, Conventional Commits, English, naming the finding id in the body:

```bash
git add <only the files this fix touched>
git commit -m "fix(scope): <what changed>

Closes audit finding <id>."
```

---

## Verification

The audit is complete when:

- [ ] `docs/audits/findings/` holds four files, one per domain, all using the template record.
- [ ] `docs/audits/2026-08-07-findings.md` exists, every table row has a matching `## Detail` entry, and every row has a Triage decision.
- [ ] Every row marked `fix` with effort S or M has exactly one commit on `chore/architecture-audit`.
- [ ] Every row marked `fix` with effort L has its own design doc under `docs/audits/`, and no code committed under this plan.
- [ ] `rtk proxy "npm test"`, `typecheck`, `lint`, `format:check` and both `codegen:check` runs pass on the branch head.
- [ ] `rtk proxy "git diff main --stat"` shows no file changed that no finding named.

# Tooling findings

**Agent:** tooling
**Baseline:** `main` at `4348600`
**Date:** 2026-08-07

Every finding below uses the record format from `_TEMPLATE.md`. Checklist
items answered but yielding no defect (pinned majors match their ranges in
`package-lock.json`, duplicated devDependency ranges currently agree between
workspaces, `.gitignore`/`.prettierignore` coverage is complete, README
commands and test counts check out, no deployment claim exists to be gapped)
are not written up as findings — see the closing notes for the evidence.

---

## tool-01 — The gate is entirely manual and self-reported, and it has already missed once

- **severity:** high
- **confidence:** verified
- **evidence:**
  - No `.github/` directory exists in the repository (`ls -la` from repo
    root — absent; confirmed via `rtk proxy "git status --short"` showing a
    clean tree with no CI config anywhere in `git ls-files`).
  - `CLAUDE.md:99-100` — "`format:check` is part of the gate**, alongside
    `test`, `typecheck`, `lint` and `codegen:check`. Two slice-2 tasks were
    sent back for skipping it."
  - Corroborating rework commit: `5cd82a6` "style: format the category model
    test", part of PR #5 (`feat/slice-2-categories`, verified via
    `gh pr view 5 --json commits`). Its diff
    (`rtk proxy "git show 5cd82a6"`) is a pure Prettier re-wrap of an import
    statement in `apps/backend/tests/integration/category-model.test.ts` — a
    `format:check` failure that had to be caught and fixed after the fact,
    inside the same branch, because nothing ran it automatically as the task
    landed. Only one such dedicated fix commit is visible in
    `gh pr view 5 --json commits -q '.commits[].messageHeadline'`; the
    CLAUDE.md claim of "two" tasks is corroborated for one instance and not
    falsifiable for the second from git history alone — a second slip could
    have been folded into another commit without its own trailer.
  - PR #5's body (`gh pr view 5 --json body`), under "Verification":
    "Local, through `rtk proxy` — the RTK hook filters output and has
    reported a pass for a command that failed. **There is no CI, so every
    number here comes from a local run** at `afe4fc8`." The same pattern
    holds for every one of the 11 merged PRs on `main`.
- **cost:** Every commit that has ever landed on `main` — all five slices —
  did so with zero independent verification. The only thing standing between
  a broken commit and `main` is a human running `test`, `typecheck`, `lint`,
  `format:check` and `codegen:check` (twice) by hand and transcribing the
  output into a PR description. That already failed at least once (the
  `5cd82a6` rework), and the failure mode is exactly the one you'd predict:
  a step silently skipped, caught only because someone happened to look.
  Nothing would have caught it, and nothing would catch the next one, before
  merge.
- **fix:** Add `.github/workflows/ci.yml` running on `pull_request` against
  `main`: `npm ci`, then `npm run lint`, `npm run format:check`, `npm test`,
  `npm run typecheck`, `npm run codegen:check -w backend`,
  `npm run codegen:check -w frontend`. No source change required. Effort: S
  (one new file). Out of scope for this audit to apply — recorded as a
  finding only.

---

## tool-02 — No pre-commit hook either, so nothing mechanical runs before tool-01's gap

- **severity:** high
- **confidence:** verified
- **evidence:**
  - `.git/hooks/` contains only the stock `*.sample` files — no
    `pre-commit`, no `commit-msg` — verified with
    `ls .git/hooks | grep -v '\.sample$'` (empty output, exit 0).
  - No `husky`, `lint-staged`, or `simple-git-hooks` in any of
    `package.json`, `backend/package.json`, `frontend/package.json` — a
    combined grep for those three terms across all three manifests returns
    nothing.
- **cost:** Combined with tool-01, there is no mechanical enforcement
  anywhere in the pipeline: not at commit time, not at merge time. Every
  guarantee in "Definition of done" (`CLAUDE.md`) rests entirely on the
  person doing the commit remembering to run the checklist — the exact
  gap `5cd82a6` (tool-01) shows already happened once.
- **fix:** `simple-git-hooks` + `lint-staged` running `prettier --check`
  and `eslint --max-warnings 0` on staged files pre-commit. Small,
  dependency-light, and targets the specific failure mode already observed
  (a formatting-only miss). Effort: S (root `package.json` +
  `.simple-git-hooks.json`, no source change).

---

## tool-03 — The gate is six commands a reviewer must remember, not one

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - Root `package.json:11-21` defines `test`, `typecheck`, `lint`,
    `format:check` — no aggregate `codegen:check`.
  - `backend/package.json:13` —
    `"codegen:check": "graphql-codegen --config codegen.ts && git diff --exit-code schema.graphql src/graphql/generated"`.
  - `frontend/package.json:13` —
    `"codegen:check": "graphql-codegen --config codegen.ts && git diff --exit-code src/graphql/generated"`.
  - `README.md`'s own "Verifying it" section lists six separate commands to
    reproduce the gate, run in order (`npm test`, `npm run typecheck`,
    `npm run lint`, `npm run format:check`,
    `npm run codegen:check -w backend`, `npm run codegen:check -w frontend`)
    — I ran each verbatim via `rtk proxy` and all six passed cleanly
    (276+324 tests, clean typecheck/lint/format, both codegen diffs empty).
- **cost:** A reviewer (or the implementer, before pushing) has to remember
  six commands, in two different invocation shapes (`npm run X` vs.
  `npm run X -w <workspace>`), with no single command failing loudly if one
  is forgotten. This is structurally the same shape of mistake that produced
  the `5cd82a6` rework in tool-01 — a step that a script would remember
  automatically was left to memory.
- **fix:** Add a root `"verify"` script chaining the six commands
  (`npm test && npm run typecheck && npm run lint && npm run format:check && npm run codegen:check -w backend && npm run codegen:check -w frontend`),
  and point the README's "Verifying it" section at it. Effort: S (root
  `package.json`, +README).

---

## tool-04 — The declared Node range is wider than the toolchain actually supports, and the README repeats the wrong number

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - Root `package.json:8-10` — `"engines": { "node": ">=20" }`. No
    `.nvmrc` or `.tool-versions` anywhere in the repo.
  - `README.md:12` — "Requires **Node 20 or newer**."
  - Installed `vite@8.2.0`'s own manifest declares
    `"engines": { "node": "^20.19.0 || >=22.12.0" }` (read from
    `node_modules/vite/package.json`) — Node 20.0.0–20.18.x and all of
    Node 21 are outside that range despite satisfying `>=20`.
  - `backend/package.json:6` (`dev`) and `:17`/`:20` (`db:seed` /
    `prisma.seed`) invoke `tsx --env-file-if-exists=.env`. The
    `--env-file-if-exists` flag did not exist before Node v20.19.0 (added
    via nodejs/node#53060, landed in the v20.19.0 LTS release per
    nodejs.org's own v20.19.0 release notes) — it is unavailable on any
    Node 20.0–20.18 install and on all of Node 21.
  - Both constraints converge on the same real floor: **Node 20.19.0**, not
    the bare "20" the `engines` field and the README both advertise.
- **cost:** A contributor who installs "Node 20" literally (e.g. an LTS
  point release before 20.19.0, still satisfying `>=20` and matching the
  README's own instruction) gets a working `npm install` but a crash on
  `npm run dev -w backend` (unrecognized flag) and a Vite engines warning
  or failure on frontend commands. The stated minimum doesn't actually run
  the stated dev command.
- **fix:** Tighten `engines.node` in root `package.json` to
  `"^20.19.0 || >=22.12.0"`, add a `.nvmrc` (e.g. `22`), and correct
  `README.md:12` to state the real floor. Effort: S — all three are
  config/doc edits, no source change. Not applied here; source, config and
  docs are out of scope for this audit.

---

## tool-05 — A password-shaped literal exists outside the two files `.gitguardian.yaml` exempts

- **severity:** low
- **confidence:** verified (existence and exemption gap); hypothesis (that a
  scanner would actually flag it)
- **evidence:**
  - `backend/.env.example:8` — `SEED_PASSWORD=trocar-esta-senha`.
  - `.gitguardian.yaml:11-14` exempts only `backend/tests/helpers/credentials.ts`
    and `frontend/src/test/credentials.ts`, with a comment claiming the scope
    was deliberately scoped: "Only the two modules that define test
    credentials are exempt. Every other path stays scanned... Nothing in
    either file opens anything."
- **cost:** The value is a harmless placeholder (its own name means "change
  this password") consumed only by the dev seed script against a throwaway
  SQLite file, so there is no live credential at risk today. But it is a
  `KEY=literal` pair in a tracked file, exactly the shape generic-password
  detectors are tuned for, and the `.gitguardian.yaml` comment's claim of a
  deliberately-scoped exemption list didn't account for it. The day
  secret-scanning is wired into any gate (see tool-01), this either
  false-positives that gate or has to be re-triaged from scratch.
- **fix:** Rename to something a scanner is more likely to skip and a human
  instantly reads as non-secret (e.g. `SEED_PASSWORD=dev-only-change-me`),
  or add it to `.gitguardian.yaml`'s ignored paths with the same reasoning
  comment style already used there. Effort: S (2 files: `.env.example` and
  `.gitguardian.yaml`, or just the former).

---

## tool-06 — The Prisma config the ^6 pin relies on is already deprecated

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `backend/package.json:19-21` —
    ```
    "prisma": {
      "seed": "tsx --env-file-if-exists=.env prisma/seed.ts"
    }
    ```
  - Running the backend test suite (`rtk proxy "npm test"`) prints, before
    any test output: "warn The configuration property
    `package.json#prisma` is deprecated and will be removed in Prisma 7.
    Please migrate to a Prisma config file (e.g., `prisma.config.ts`)."
  - `CLAUDE.md` (Pinned majors gotcha) records that `prisma`/`@prisma/client`
    are deliberately held at `^6` because 7 "rejects `url` inside
    `datasource db` and drops the `prisma-client-js` generator."
- **cost:** The pin to `^6` was made to dodge a breaking change in 7, but the
  `package.json#prisma` seed-config mechanism this repo still uses is
  already marked for removal independently of that pin — so the migration
  being postponed will still be forced at the next major regardless, and
  every `test`/`db:seed` run already prints a warning that could mask a real
  one appearing alongside it in CI output (once tool-01 exists).
- **fix:** Migrate the seed config to `prisma.config.ts` now, while still on
  `^6`, rather than as a forced part of a future major bump. Effort: S (add
  `backend/prisma.config.ts`, drop the `prisma` key from
  `backend/package.json`).

---

## Checklist items verified with no defect (not written up as findings)

- **Pinned majors (item 5):** `prisma`/`@prisma/client` `^6.19.3`,
  `@apollo/server` `^4.13.0`, `express`/`@types/express` `^4.22.2`/`^4.17.25`
  all match the ranges `CLAUDE.md` documents, and `package-lock.json`
  resolves each to a version inside that range (checked via the lockfile's
  `packages` map) — no drift.
- **Duplicated devDependencies (item 6):** `@graphql-codegen/cli`
  (`^7.2.0`), `@graphql-codegen/typescript` (`^6.1.0`), `typescript`
  (`^6.0.3`) and `vitest` (`^4.1.10`) are each declared identically in
  `backend/package.json` and `frontend/package.json`, and `package-lock.json`
  hoists a single shared copy of each to the root `node_modules` (no
  per-workspace copy exists) — confirmed no version skew today. There is
  no mechanism that would catch a future skew if one workspace's range
  changed and the other didn't, but since no skew exists yet there is no
  concrete cost to name, so this is not written up as a finding per the
  anti-boilerplate rule.
- **Build and start (item 7):** `rtk proxy "npm run build -w @financy/backend"`
  succeeds and produces `backend/dist/src/server.js`, matching
  `backend/package.json:8`'s `"start": "node dist/src/server.js"` exactly.
  `rtk proxy "npm run build -w @financy/frontend"` succeeds. `dist/` is
  covered by `.gitignore:7`, and `git status --short` was clean after both
  builds — nothing to clean up.
- **Ignore coverage (item 8):** `.gitignore` covers `.env`/`.env.*` (with
  `.env.example` explicitly un-ignored), `*.db`, `dist/` and
  `*.tsbuildinfo`. `.prettierignore:11` explicitly excludes
  `backend/schema.graphql` with a comment matching `CLAUDE.md`'s stated
  reason. Complete.
- **Deployment story (item 10):** Neither `README.md` nor
  `docs/plans/roadmap.md` makes any deployment claim; `README.md:13` states
  "there is no Docker, no service to start" as a deliberate design choice.
  No Dockerfile is absent-as-a-gap here — nothing claims one should exist.
- **README accuracy (item 11):** Every command in "Running it locally" and
  "Verifying it" was run verbatim through `rtk proxy` from a repo state with
  `backend/.env`, `frontend/.env` and `backend/prisma/dev.db` already
  present. `npm test` reported exactly "276 passed" (backend) and "324
  passed" (frontend), matching the README's claimed "600 tests: 276
  backend, 324 frontend" precisely. `typecheck`, `lint`, `format:check`, and
  both `codegen:check -w backend`/`-w frontend` (the exact `-w <name>`
  shorthand the README uses) all passed. The one inaccuracy found —
  "Requires Node 20 or newer" — is folded into tool-04 rather than
  duplicated here, since it's the same underlying gap.

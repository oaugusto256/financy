# Financy

Personal finance manager. npm workspaces monorepo: `apps/backend` (Express +
Apollo Server 4 + Prisma + SQLite) and `apps/frontend` (React 19 + Vite +
TanStack Query + Tailwind 4).

## Where things are

| Path | What |
|---|---|
| `docs/specs/backend.md`, `frontend.md` | Source of truth for behavior. Section 12 of `frontend.md` records deliberate deviations from the design. |
| `docs/plans/roadmap.md` | The five slices and the definition of done. |
| `docs/plans/slice-N-*.md` | Per-slice implementation plans. **Large** — `slice-3` is 184 KB, `slice-2` 153 KB, `slice-1` 129 KB, `slice-4` and `slice-0` 92 KB each. Read the matching `slice-N-outcome.md` instead; they exist so none of the plans has to be read whole. |
| `apps/backend/src/modules/<name>/` | `schema.ts`, `resolvers.ts`, `service.ts`, `validation.ts` — organized by module, not by file type. `auth/`, `category/` and `transaction/` exist. |
| `apps/backend/src/shared/` | `errors.ts`, `auth-guard.ts`, `env.ts`, `prisma.ts`, `password.ts`, `jwt.ts`, `dataloaders.ts`. |
| `apps/frontend/src/features/<name>/` | Screens and their feature-local logic. |
| `apps/frontend/src/components/ui/` | Design-system primitives. Browsable at `/style-guide`. |

## Commands

```bash
npm run dev            # both apps; backend :4000, frontend :5173
npm test               # both workspaces
npm run typecheck
npm run lint
npm run format:check
npm run codegen:check -w @financy/backend    # must report no diff
npm run codegen:check -w @financy/frontend
```

Tests need no `.env` and no running server: each vitest config declares its own
environment, and the backend applies migrations to a separate `test.db` first.

**Run anything you cite as evidence through `rtk proxy "<cmd>"`.** The RTK hook
filters output and has reported a pass for a command that failed, and a stale
SHA for a `git log`. A claim from a filtered run is not verified.

## Conventions

- TypeScript everywhere, `strict: true`. **No `any`** — lint rejects it outside
  `generated/`.
- **Interface language is Brazilian Portuguese. Code, comments, commit messages
  and PR descriptions are English.**
- Colors come from the theme in `src/index.css`. No color literal outside it.
- Icons: `lucide-react` only.
- Conventional Commits, one commit per task.
- Every new environment variable lands in the matching `.env.example` in the
  same commit.

## Definition of done

The full checklist is in `roadmap.md`. The lines most often missed:

- Every new query and mutation filters by the calling user **in the where
  clause**, with a cross-user test asserting `NOT_FOUND`.
- Inputs are validated by zod before reaching Prisma.
- Any schema change has a committed Prisma migration.
- Loading, empty, error and populated states are all implemented.
- Destructive actions confirm first.
- If the implementation reveals the spec is wrong, **the spec is corrected in
  the same PR**.

## Gotchas that have already cost time

- **Pinned majors — do not let an install drift them.** `prisma` and
  `@prisma/client` at `^6` (7 rejects `url` inside `datasource db` and drops the
  `prisma-client-js` generator); `@apollo/server` at `^4` (5 removed the
  `./express4` export); `express` and `@types/express` at `^4` (required by
  `@apollo/server/express4`). Check `git diff package.json` before committing.
- **Module SDL is a `/* GraphQL */`-tagged template literal in `schema.ts`**, not
  a `.graphql` file — a runtime read would force the build to copy
  non-TypeScript files into `dist/`. Codegen plucks it out of the magic comment.
- **`apps/backend/schema.graphql` is generated and committed**, and is in
  `.prettierignore` — formatting it makes `format:check` and `codegen:check`
  undo each other. A test compares it against the served SDL.
- **Frontend codegen uses `typescript-operations` without the schema-wide
  `typescript` plugin.** As of codegen 6 the operations plugin emits the input
  types it references; keeping both declares each of them twice.
- **zod 4**: `z.email()`, not `z.string().email()`. `required_error` is silently
  ignored — set every message positionally or through `.min`.
- **Prisma diagnostics from the editor go stale** after `prisma generate`.
  `npm run typecheck` is the authority.
- **Test credentials live in `tests/helpers/credentials.ts` (backend) and
  `src/test/credentials.ts` (frontend).** `.gitguardian.yaml` exempts only those
  two files, so a password-shaped literal anywhere else is still scanned.
- **MSW is strict**: `onUnhandledRequest: 'error'`. A test that fires an
  unmocked request fails, which several tests use as the assertion.
- **Frontend codegen sets `enumsAsTypes`.** A queried `icon` or `color` is then
  the same string-literal union `src/lib/category-tokens.ts` is keyed by; a real
  TypeScript enum needs a cast at every badge, tag and picker.
- **Tailwind never sees a class name built at runtime.** No template string, no
  `.replace()`, no interpolation — spell the class out and compose with `cn()`.
  A constructed class compiles to nothing and the element renders unstyled,
  which no test catches.
- **`format:check` is part of the gate**, alongside `test`, `typecheck`, `lint`
  and `codegen:check`. Two slice-2 tasks were sent back for skipping it.
- **DataLoaders are built per request in `createContext`, capturing `userId`.**
  Sharing one across requests serves one caller's totals to the next.

## Two standing constraints

- **No CI.** Nothing runs the checks on push. Every claim about a green suite
  comes from a local run.
- **Figma is not reachable from the repo.** Visual comparison is the owner's
  job. Produce an explicit checklist and hand it over rather than guessing;
  `docs/plans/slice-2-figma-handoff.md` is the format. Nothing is blocking as of
  slice 4: the sixteen `CategoryIcon` names are confirmed. The `/style-guide`
  primitive comparison is still unanswered after four slices — it has never
  gated anything, so it is carried forward rather than chased. A checklist only
  gates work when it asks about something the code is being built on — and if
  it does, render the thing first so the owner can actually answer it. Slice 2
  had to add the `/style-guide` token galleries mid-flight for exactly that
  reason.

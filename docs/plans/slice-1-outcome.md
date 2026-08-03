# Slice 1 — outcome

Status: merged to `main` in two pull requests, #3 and #4, on 2026-08-03.

What [`slice-1-auth-and-profile.md`](./slice-1-auth-and-profile.md) planned and
what actually landed, so slice 2 starts from the built state rather than from
the plan. The plan file keeps its own step checkboxes; this file records the
things a reader of that plan could not infer.

## What shipped

**Backend.** The `User` model and the first migration, with a global setup that
applies migrations to `test.db` before the suite. argon2id hashing and `jose`
JWTs, both pinning their algorithm. The error codes from `backend.md` section 7,
a request context that resolves a bearer token to a `userId` exactly once, and a
`requireUser` guard that is the only way to read it. The first module under
`src/modules/auth/` — SDL, resolvers, service and validation together — merged
into `src/schema.ts`. graphql-codegen emits resolver types and a committed
`schema.graphql`.

**Frontend.** Typed hooks generated from that committed schema, a `Checkbox`
primitive, token storage split across `localStorage` and `sessionStorage`, an
MSW harness, a session context hydrated synchronously on the first render, route
guards with a root route that serves login or dashboard, the login, sign up and
profile screens, and a client-level `UNAUTHENTICATED` notifier that returns any
expired session to the login screen.

**Verification at merge.** 73 backend and 119 frontend tests, `typecheck`,
`lint`, `format:check`, and `codegen:check` in both workspaces reporting no
diff. Run through `rtk proxy`, because the RTK filter can report a pass for a
command that failed — it misreported a `git log` during this slice's branch
work.

## Where the build departed from the plan

Each is explained in the commit that makes it. Collected here because several
constrain slice 2.

| Departure | Why |
|---|---|
| Frontend codegen drops the schema-wide `typescript` plugin | As of codegen 6 the operations plugin emits the input types it references, so keeping both declared each of them twice. |
| `fetcher` takes `{ toString(): string }` and a third headers argument | Codegen emits documents as `TypedDocumentString`, which extends `String` and is not assignable to the primitive; `exposeFetcher` generates three-argument calls. |
| `Me` query carries `staleTime: Infinity` | Without it `signIn`'s seeded payload is stale on arrival and refetched — the round trip seeding exists to avoid. `updateProfile` invalidates the key explicitly. |
| Sign-out asserts no cache entry holds data, not that the cache is empty | The mounted query rebuilds its own empty entry on the render after `clear()`. The property being defended is unchanged. |
| The schema drift test sorts both sides before comparing | `schema-ast` writes the artifact lexicographically while `printSchema` keeps source order, so an unsorted diff failed on declaration order alone. Verified it still catches a renamed field. |
| `SessionContext` object lives in `useSession.ts` | Exporting it beside the provider is the react-refresh hazard the plan split the hook out to avoid. |
| `schema.graphql` is in `.prettierignore` | Otherwise `format:check` and `codegen:check` each undo what the other wrote. |

Three gaps the plan did not cover, fixed in passing: `health.test.ts` needed the
context generic once `createApp` was typed; `App.test.tsx` asserted a Dashboard
heading at a root that now serves login; and `routes.tsx` could not import page
modules that later tasks create, so it used a placeholder that left the two
heading assertions genuinely unmet rather than hiding them behind a load
failure.

## Follow-ups after the plan (#4)

- `npm run dev` runs both applications through `concurrently`. Backgrounding
  with `&` and `wait` orphans the `tsx watch` and `vite` children on Ctrl-C,
  which then hold ports 4000 and 5173 against the next run.
- Test credentials moved into one fixture module per workspace, after
  GitGuardian flagged 15 generic passwords on #3. All were fixtures; the audit
  found no `.env` ever committed, none tracked, `JWT_SECRET` empty in
  `.env.example`, and no high-entropy string in tracked source.
  `.gitguardian.yaml` exempts only those two modules, so every suite stays
  scanned.
- Auth screen details from the owner's first Figma pass: placeholders on both
  forms, a `UserPlus` icon in the login screen's "Criar conta" link, the
  "Já tem uma conta?" prompt on sign up, and both headings centered.

## Open going into slice 2

- **Blocking.** Slice 0's two carried-forward Figma checks: the sixteen
  `CategoryIcon` names against the Style Guide, and the `/style-guide` primitive
  comparison. Slice 2 is the first slice to render category icons, so a wrong
  name is a blank square in the feature being built.
- **Not blocking.** The manual browser walkthrough in
  [`slice-1-figma-handoff.md`](./slice-1-figma-handoff.md), especially step 6 —
  signing in without "Lembrar-me", closing the tab, confirming the login screen
  returns. A test covers it against a jsdom storage that has no tab lifecycle.
- **Not blocking.** The remaining slice 1 Figma comparisons: login card width
  and padding, the "ou" divider, profile avatar size, the disabled email
  field's fill, and checkbox metrics.

## Debts slice 2 is expected to settle

- **The toast component.** `frontend.md` section 10 specifies toasts; slice 1
  gives the profile screen an inline `role="status"` message instead, recorded
  as a temporary deviation in section 12. Slice 2 adds three mutations and two
  destructive confirmations, which is where the shape of a toast is actually
  known. Building it removes that section 12 entry.
- **`prisma/seed.ts`.** Deferred from slice 1 because it seeds categories and
  transactions. It lands in slice 3, in one commit, rather than being rewritten
  in three.
- **`Mutation._empty`.** It exists only so `extend type Mutation` has something
  to extend. The moment slice 2's module extends the same root type, it can go.
- **`resetDatabase`.** One `deleteMany` is enough while `User` is the only
  model. Slice 2 extends it only if it adds a row that no user owns.
- **No CI.** Nothing runs the checks on push. Every claim in this file came from
  a local run.

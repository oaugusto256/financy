# Security and data-integrity findings

**Agent:** security
**Baseline:** `main` at `4348600`
**Date:** 2026-08-07

Nine findings, ordered by severity. Everything cited as command output was run
through `rtk proxy`. Where a claim needed the running server, it was produced by
booting `createApp()` against a scratchpad copy of `test.db` on port 4321 and
sending real HTTP requests; the transcript of that run is quoted inline.

The five checklist items that came back clean are recorded at the bottom under
**Checked and clean**, with the evidence, because "no finding" is also an
answer and the next audit should not have to redo the work.

---

## sec-01 — A one-character `JWT_SECRET` passes boot validation, and every session token is HS256

- **severity:** high
- **confidence:** verified
- **evidence:**
  - `backend/src/shared/env.ts:5` — `JWT_SECRET: z.string().min(1, 'JWT_SECRET is required')`. The only constraint is non-empty. There is no length, entropy or character-class check anywhere else; `backend/src/shared/jwt.ts:4` feeds the value straight into `new TextEncoder().encode(...)` and uses it as the HMAC key.
  - `backend/src/shared/jwt.ts:5` — `const ALGORITHM = 'HS256'`, a symmetric MAC: the key that verifies a token is the key that mints one.
  - `backend/.env.example:2` — ships `JWT_SECRET=` with no value and no comment stating a minimum length, so the operator has no signal either.
  - command: booted the real app with `JWT_SECRET="x"` —
    `env -u NODE_ENV DATABASE_URL="file:…/audit.db" JWT_SECRET="x" CORS_ORIGIN="http://localhost:5173" npx tsx …/probe.mts`
    → `1. signUp ok: true`. The server started, validated its environment, and
    issued a working bearer token signed with a one-byte key.
  - `backend/tests/unit/env.test.ts:34-42` — the only `JWT_SECRET` tests assert
    that *missing* and *empty* throw. Nothing asserts that a short secret throws,
    so adding a length rule would not break the suite, and its absence is not
    currently caught.
- **cost:** An HS256 key of a handful of characters is recovered offline from a
  single captured token in seconds (`hashcat -m 16500`). The attacker needs one
  token, which they can get by signing up themselves — the token is handed to
  the browser and parked in `localStorage` (see sec-07). With the key they can
  re-sign any token they have seen with a fresh `exp` (sec-06 gives them a
  7-day window and no revocation to fight), and mint a token for any `sub` they
  can name. `sub` is a uuid and not published anywhere in the API, which is the
  only thing standing between key recovery and total account takeover — that is
  an accident of the id format, not a control. Note the repo cannot tell you
  whether the *deployed* secret is weak: `.env` is gitignored
  (`.gitignore:13-15`) and untracked (`rtk proxy "git ls-files backend/.env"` →
  empty). The finding is that nothing stops it from being weak.
- **fix:** `backend/src/shared/env.ts:5` → `z.string().min(32, 'JWT_SECRET must
  be at least 32 characters')`; add the same expectation as a comment in
  `backend/.env.example`; add the negative case to
  `backend/tests/unit/env.test.ts`. Rotate whatever is currently deployed —
  rotation invalidates every outstanding token, which is the intended effect.
  Effort: S.

---

## sec-02 — Nothing rate-limits `signIn` or `signUp`; credential stuffing against `POST /graphql` is unbounded

- **severity:** high
- **confidence:** verified
- **evidence:**
  - `backend/src/app.ts:21-31` — the entire `/graphql` middleware chain is
    `cors(...)`, `express.json()`, `expressMiddleware(apollo, ...)`. No limiter,
    no slow-down, no captcha, no lockout.
  - command: `grep -rniE "rate.?limit|throttle|helmet" backend/src docs/specs`
    → the only hits are `limit:` on the pagination argument
    (`backend/src/modules/transaction/validation.ts:115,135`,
    `backend/src/modules/transaction/schema.ts:53`). Nothing about request rate.
  - `backend/package.json` dependencies — `@apollo/server`, `@node-rs/argon2`,
    `@prisma/client`, `cors`, `dataloader`, `express`, `graphql`,
    `graphql-scalars`, `jose`, `zod`. No `express-rate-limit`, no `helmet`, no
    `rate-limiter-flexible`.
  - `backend/src/modules/auth/service.ts:35-48` — `signIn` has no attempt
    counter, no per-account backoff, and no state beyond the `User` row; there
    is no `failedAttempts` or `lockedUntil` column in
    `backend/prisma/schema.prisma:18-27` to hold one.
  - command: against the running app —
    `4. 50 sequential failed sign-ins: 50 answered INVALID_CREDENTIALS (no 429) in 751ms`.
    Fifty guesses at one existing account, on one connection, answered in under a
    second. ~66 guesses/second serially; the argon2 work runs on the libuv
    threadpool, so parallel connections multiply it further.
  - The attack request, verbatim:
    `POST /graphql` with body
    `{"query":"mutation{ signIn(input:{email:\"ana@financy.dev\",password:\"<guess>\"}){ token } }"}`,
    repeated. No header, no cookie, no token required — `signIn` is reached
    without authentication by definition
    (`backend/src/modules/auth/resolvers.ts:12`).
- **cost:** With sec-05 an attacker first confirms which addresses have
  accounts, then grinds those accounts at tens of guesses per second per
  connection with nothing to stop them. The password floor is eight characters
  (`backend/src/modules/auth/validation.ts:13`) with no composition rule, so
  reused-password stuffing lists work. `signUp` is equally unbounded: each call
  costs a 19 MiB argon2 hash (see sec-05 evidence) and creates a row, so a loop
  is also a memory-pressure and disk-growth vector on a single-file SQLite
  database.
- **Two things that do *not* bound it, checked so the fix is not aimed at the
  wrong place:** (a) Alias amplification does not work here. A single POST
  carrying 200 aliased `signIn` mutations was answered with exactly one
  attempt — `3. one POST carried 200 signIn aliases -> 1 INVALID_CREDENTIALS in 32ms; status 200`
  — because `signIn: AuthPayload!` is non-null
  (`backend/schema.graphql` `Mutation.signIn`), so the first error propagates to
  `data: null` and halts serial execution. That is a real defence, but an
  accidental one; it would evaporate the day the field becomes nullable.
  (b) `express.json()` at `backend/src/app.ts:29` takes no options, so bodies are
  capped at the 100 kB default. That bounds one request's size, not the number
  of requests.
- **fix:** `express-rate-limit` (or `rate-limiter-flexible`) mounted ahead of
  `expressMiddleware` in `backend/src/app.ts:21`, keyed on IP, with a tighter
  second limiter keyed on the submitted email for `signIn`/`signUp`
  specifically — a per-IP limit alone is defeated by a botnet spraying one
  guess per address. Add the limits to `backend/.env.example` if they are
  configurable. Files: `app.ts`, `.env.example`, `env.ts`, one integration test.
  Effort: M.

---

## sec-03 — Two transactions at the `Int` ceiling permanently break the `summary` query

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - `backend/src/modules/transaction/validation.ts:26-28` — `amount` is
    `z.int().positive(...)`. There is a lower bound and no upper bound.
  - `backend/prisma/schema.prisma:39` — `amount Int // cents`, which SQLite
    stores as a 64-bit INTEGER, so the database happily holds the sum.
  - `backend/src/modules/summary/service.ts:66-70` — `totalBalance`,
    `monthIncome` and `monthExpense` are the raw `groupBy` sums, and
    `backend/schema.graphql` declares all three `Int!`. Same shape for
    `Category.totalAmount`, fed by `backend/src/shared/dataloaders.ts:45`.
  - command: `rtk proxy "node …/int.mjs"` →
    `2147483647 => serialize ok: 2147483647` /
    `4294967294 => THROWS: Int cannot represent non 32-bit signed integer value: 4294967294`.
    So each individual amount is capped by the scalar on the way *in*, but the
    aggregate is not capped on the way *out*.
  - command: end to end against the running app — two `createTransaction`
    mutations with `amount: 2147483647, type: INCOME` (both accepted, no error),
    then `query{ summary(month:1, year:2026){ totalBalance monthIncome } }` →
    `7b. summary after two max-Int incomes -> {"message":"Int cannot represent non 32-bit signed integer value: 4294967294", … "path":["summary","totalBalance"], "extensions":{"code":"INTERNAL_SERVER_ERROR", …}}`.
  - `frontend/src/lib/currency.ts:9,41` — the frontend *does* know the ceiling
    (`MAX_CENTS = 2_147_483_647`) and clamps input in `digitsToCents`. The
    backend does not. A client that is not this frontend — or this frontend
    after a refactor — sends the uncapped value.
- **cost:** `totalBalance` is non-null, so the error nulls the whole `summary`
  field and the dashboard returns `data: null` with `INTERNAL_SERVER_ERROR`
  forever, for every month, until the offending rows are removed. Recovery is
  possible (the transactions list still renders — each row's own `amount` is
  under the ceiling — so the user can delete them), but the dashboard is dead
  until they work out which rows to delete, and the error message tells them
  nothing about that. Three amounts of R$ 8.000.000,00 also do it, which is not
  an absurd figure for someone tracking a business account in BRL. Note the
  spec is silent on the ceiling: `docs/specs/backend.md` §5 defines the three
  figures without bounding them, so this should be corrected in the same PR per
  the definition of done.
- **fix:** Cheapest correct version: cap `amount` in
  `backend/src/modules/transaction/validation.ts` at a value whose realistic
  aggregate cannot overflow (e.g. `.max(100_000_000)` = R$ 1.000.000,00) with a
  Portuguese message, and record the cap in `docs/specs/backend.md` §5 and
  `frontend/src/lib/currency.ts`. The thorough version — change the aggregate
  fields to a `BigInt`/`String` scalar — changes a public contract and touches
  every display call site. Effort: M for the cap, L for the scalar.

---

## sec-04 — Apollo's production posture is unpinned: with `NODE_ENV` unset the server serves introspection and full stack traces, and no `formatError` masks internal messages

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - `backend/src/app.ts:16` — `new ApolloServer<GraphQLContext>({ typeDefs, resolvers })`.
    No `introspection`, no `includeStacktraceInErrorResponses`, no `formatError`,
    no `validationRules`, no `maxRecursiveSelections`. Every safety default is
    inherited.
  - `node_modules/@apollo/server/dist/esm/ApolloServer.js:30,33,62` —
    `const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV ?? ''`, then
    `const isDev = nodeEnv !== 'production'` and
    `const introspectionEnabled = config.introspection ?? isDev`. Apollo reads
    `process.env` **directly**.
  - `node_modules/@apollo/server/dist/esm/ApolloServer.js:92-93` —
    `includeStacktraceInErrorResponses: config.includeStacktraceInErrorResponses ?? (nodeEnv !== 'production' && nodeEnv !== 'test')`.
  - `backend/src/shared/env.ts:8-10` — `NODE_ENV` is declared
    `.default('development')`, i.e. **optional**, and `parseEnv` returns a parsed
    object; it never writes back to `process.env`. So an operator who omits
    `NODE_ENV` gets a server that boots cleanly, reports itself as
    `development`, and hands Apollo an empty string.
  - command: booted with `env -u NODE_ENV` →
    `2. introspection served: true | type count: 33 | err: none`, and every error
    carried `extensions.stacktrace` with absolute host paths:
    `"at GraphQLScalarType.serialize (/Users/otavioaugusto/projects/financy/node_modules/graphql/type/scalars.js:73:13)"`.
    (Setting `NODE_ENV=""` explicitly *does* fail boot — zod rejects the empty
    string — so the hole is specifically the unset case that `.default()` waves
    through.)
  - `node_modules/@apollo/server/dist/esm/errorNormalize.js:5,52-57` —
    `const formatError = options.formatError ?? ((error) => error)` and
    `ensureGraphQLError` builds `new GraphQLError(messagePrefixIfNotGraphQLError + error.message)`.
    Apollo Server 4 does **not** mask unexpected error messages; it only tags
    them `INTERNAL_SERVER_ERROR` and conditionally attaches the stack. So any
    thrown message reaches the wire verbatim — confirmed by the sec-03
    transcript, where a graphql-js internal message was returned to an
    unprivileged client.
- **cost:** A deployment that forgets `NODE_ENV=production` — which this app's
  own env contract says is optional — publishes its full schema to anyone and
  returns host filesystem paths, `node_modules` layout and Node internals in
  every error response. Combined with sec-08, a Prisma `P2002` reaches the
  client as ``Invalid `prisma.user.create()` invocation … Unique constraint
  failed on the fields: (`email`)``, which names the table and column. Nothing
  in the repo would catch the misconfiguration: there is no CI (CLAUDE.md, "Two
  standing constraints") and no test asserts introspection is off in production.
- **fix:** In `backend/src/app.ts:16`, pass explicitly from the validated env
  rather than relying on `process.env`: `introspection: env.NODE_ENV !== 'production'`,
  `includeStacktraceInErrorResponses: env.NODE_ENV === 'development'`, and a
  `formatError` that passes through the five known codes in
  `backend/src/shared/errors.ts:4-10` and replaces anything else with a fixed
  message. Separately, consider making `NODE_ENV` required in
  `backend/src/shared/env.ts:8-10` so the ambiguity cannot arise. Files:
  `app.ts`, `env.ts`, `.env.example`, one integration test. Effort: M.

---

## sec-05 — `signIn` reveals whether an address has an account through a 24× response-time difference

- **severity:** medium
- **confidence:** verified
- **evidence:**
  - `backend/src/modules/auth/service.ts:38-45` —
    ```
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw invalidCredentials();
    const matches = await verifyPassword(user.passwordHash, password);
    ```
    The unknown-email branch returns **before** argon2 runs. The comment at
    lines 39-41 says "The unknown-email branch still verifies nothing and
    returns the same error" — true of the error code, and precisely the reason
    the timings differ.
  - command: `rtk proxy "node …/argon.mjs"` →
    `encoded: $argon2id$v=19$m=19456,t=2,p=1` and
    `argon2 verify ms (5 samples): 13.3, 12.9, 14.2, 14.0, 13.4`. One verify is
    ~13-14 ms of work that the unknown branch simply does not do.
  - command: over real HTTP, twelve requests each, median reported —
    `5. median signIn ms — existing email 14.3, unknown email 0.6`.
  - The probe request: `POST /graphql` with
    `{"query":"mutation{ signIn(input:{email:\"<target>\",password:\"nope\"}){ token } }"}`.
    A response over ~10 ms means the address is registered.
- **cost:** A 24× gap is far above network jitter once a handful of samples are
  averaged, so an unauthenticated attacker can sweep a breach list and learn
  which addresses hold Financy accounts — which, with sec-02, is exactly the
  targeting step before unbounded stuffing.
- **Stated honestly:** enumeration is *already* possible far more cheaply, by
  design. `backend/src/modules/auth/service.ts:25-26` answers `signUp` on a
  taken address with `EMAIL_ALREADY_EXISTS`
  (`backend/src/shared/errors.ts:31-32`), confirmed by the probe:
  `6. signUp on a taken address -> EMAIL_ALREADY_EXISTS`. That is a deliberate
  product decision recorded in `docs/specs/backend.md` §7 and rendered by the
  frontend, and closing the timing channel alone does not close enumeration.
  This is still worth fixing: the timing channel is the one that is *not*
  intentional, and its comment currently claims a property the code does not
  have.
- **fix:** In `backend/src/modules/auth/service.ts`, hash a constant dummy
  password against a module-level dummy argon2 encoding on the `!user` branch so
  both paths pay the same cost, then throw. Correct the comment at lines 39-41 to
  say what is and is not equalised. Effort: S.

---

## sec-06 — Tokens live seven days, carry no issuer or audience, and cannot be revoked; sign-out is client-side only

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `backend/src/shared/jwt.ts:8-15` — `signToken` sets only `sub`, `iat` and
    `.setExpirationTime('7d')`. No `iss`, no `aud`, no `jti`.
  - `backend/src/shared/jwt.ts:20-22` — `jwtVerify(token, secret, { algorithms: [ALGORITHM] })`.
    The algorithm **is** pinned on verification, not only on signing, so
    `alg: none` and algorithm-confusion are closed. No `issuer`/`audience`
    option is passed, so neither is checked — consistent, since neither is set.
  - `backend/schema.graphql` — there is no `signOut` mutation.
    `grep -rn "signOut\|logout" backend/src backend/schema.graphql` → no output.
  - `frontend/src/features/auth/SessionContext.tsx:39-40` — sign-out is
    `clearToken(); setAuthToken(null);`. Purely local; the server is never told.
  - `backend/prisma/schema.prisma:18-27` — `User` has no `tokenVersion`,
    `sessionsInvalidatedAt` or equivalent for `createContext` to check against.
- **cost:** A token copied off a shared machine keeps working for up to seven
  days after the user signs out, and the user has no way to end the session.
  There is also no way to respond to sec-01 short of rotating `JWT_SECRET`,
  which logs out everybody at once. The missing `iss`/`aud` matter little here —
  one issuer, one audience, one secret — but they are the cheap part of the fix.
- **fix:** Add an integer `tokenVersion` to `User`, put it in the token claims,
  and compare it in `backend/src/context.ts:29`; a `signOut` mutation then
  increments it. Set and verify `iss`/`aud` in `backend/src/shared/jwt.ts` at the
  same time. Files: `schema.prisma` + migration, `jwt.ts`, `context.ts`, auth
  module, frontend `SessionContext`. Effort: L.

---

## sec-07 — The JWT is in `localStorage`/`sessionStorage`, readable by any script on the origin, and no CSP narrows that

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `frontend/src/lib/token-storage.ts:9,17` — `readToken` reads
    `localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY)`; `writeToken`
    writes to whichever the "Lembrar-me" checkbox selects. Both are readable by
    any JavaScript running on the origin.
  - `frontend/src/lib/graphql-client.ts:23-29` — the token is attached as an
    `Authorization: Bearer` header, which is what makes the storage choice
    possible in the first place.
  - `grep -rn "dangerouslySetInnerHTML\|innerHTML\|eval(" frontend/src` → no
    matches. There is no injection sink in the app today.
  - No CSP is set anywhere: `backend/src/app.ts` adds no security headers, and
    there is no `helmet` dependency (see sec-02 evidence). The Vite dev server
    and any static host serving the build set none either.
- **The tradeoff, stated:** the usual advice — move the token to an `httpOnly`
  cookie — is not free here. The SPA runs on `:5173` and the API on `:4000`
  (`backend/.env.example:3-4`, `frontend/.env.example`), i.e. **different
  origins**, so the cookie would need `SameSite=None; Secure`, which reopens
  CSRF and requires a token/double-submit defence on the API. It would also
  require a cookie-issuing endpoint, break the header path at
  `graphql-client.ts:24`, and break the `remember` toggle
  (`token-storage.ts:12-18`) — an `httpOnly` cookie cannot be inspected by the
  script that decides which store to use, so "Lembrar-me" would have to become a
  server-side `Max-Age` decision passed through `signIn`. That is four files and
  a contract change to defend against an XSS the app currently has no sink for.
- **cost:** If an XSS is ever introduced — or a compromised npm dependency runs
  in the page — the token is one `localStorage.getItem('financy.token')` away,
  and with sec-06 it stays valid for seven days after exfiltration with no way
  to revoke it.
- **fix:** Do **not** move the token. Instead: (a) serve a `Content-Security-Policy`
  from wherever the built frontend is hosted, which is the control that actually
  addresses the exposure; (b) do the sec-06 revocation work, which bounds the
  damage. Revisit cookies only if the two apps are ever put behind one origin,
  at which point `SameSite=Strict` makes the tradeoff favourable. Effort: S for
  the CSP.

---

## sec-08 — `signUp` is the one create path with no unique-violation catch, so a `P2002` can reach the client

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `backend/src/modules/auth/service.ts:25-30` — check-then-create:
    `findUnique({ where: { email } })`, throw if found, otherwise
    `prisma.user.create(...)`. No `.catch(...)` on the create.
  - `backend/prisma/schema.prisma:21` — `email String @unique`, so the database
    will raise `P2002` if two requests interleave between the read and the write.
  - `backend/src/modules/category/service.ts:22-31,81,109` — the category module
    solves exactly this: `rethrowDuplicateName` catches
    `PrismaClientKnownRequestError` code `P2002` and converts it to
    `BAD_USER_INPUT`, and its comment at lines 16-21 spells out the race. The
    auth module, written first, never got the same treatment.
  - `backend/tests/integration/category-service.test.ts:78,121` — the category
    module even has tests for the race ("answers BAD_USER_INPUT when the unique
    constraint fires under a race", "maps a P2002 from the write itself to a
    field error"). `backend/tests/integration/auth.test.ts:78-158` has no
    equivalent for `signUp`.
  - With no `formatError` (sec-04), an escaped `P2002` reaches the client with
    Prisma's message verbatim, naming the model, the operation and the
    constrained column.
- **cost:** Two concurrent sign-ups on the same address — a double-clicked
  submit button is enough — produce `INTERNAL_SERVER_ERROR` instead of the
  `EMAIL_ALREADY_EXISTS` the frontend knows how to render, so the user sees a
  generic failure on a form that has a specific, correct message for their
  situation. The race window is narrow and was not reproduced under load; the
  missing catch is what is verified here.
- **fix:** Give `backend/src/modules/auth/service.ts` the same `P2002` catch as
  the category module, mapping to `emailAlreadyExists()`; ideally hoist
  `rethrowDuplicateName`'s shape into `backend/src/shared/errors.ts` so the
  third module does not repeat it a third time. Add the race test alongside
  `auth.test.ts:103`. Effort: S.

---

## sec-09 — `SEED_PASSWORD` is read straight from `process.env`, outside the validated env, with a committed fallback

- **severity:** low
- **confidence:** verified
- **evidence:**
  - `backend/prisma/seed.ts:16` — `const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'trocar-esta-senha';`
    It is the one environment variable the codebase reads that never passes
    through `parseEnv`.
  - `backend/src/shared/env.ts:3-11` — the schema covers `DATABASE_URL`,
    `JWT_SECRET`, `PORT`, `CORS_ORIGIN`, `NODE_ENV` and nothing else.
  - `backend/.env.example:6-8` — the variable *is* documented, with a comment
    saying it is development-only. The `.env.example` side of the definition of
    done is satisfied; the validation side is not.
  - There is no guard stopping `npm run seed` against a non-development
    `DATABASE_URL`; the script's protection is the docstring at
    `backend/prisma/seed.ts:1-10`.
- **cost:** Running the seed against a real database creates a user
  `ana@financy.dev` whose password is a string committed to the repository, and
  the seed deletes that user's rows on every run. The failure mode is an
  operator mistake, not an attack, and it is one command away.
- **fix:** Either add `SEED_PASSWORD` to the `envSchema` as an optional field
  with a minimum length, or — better — have `backend/prisma/seed.ts` refuse to
  run when `env.NODE_ENV !== 'development'`. Effort: S.

---

## Checked and clean

These are the checklist items that produced no finding. Recorded with evidence
so the work is not repeated.

**1. Per-user scoping — every Prisma call is scoped in the `where` clause.**
Enumerated all seventeen calls across the three services. Reads:
`category/service.ts:38` (`findFirst { userId, name, NOT }`), `:49`
(`findMany { userId }`), `:59` (`findFirst { id, userId }`), `:135`
(`count { userId }`), `:138` (`count { userId }`), `:139-143`
(`groupBy { userId, categoryId: { not: null } }`), `:156-159`
(`findFirst { userId, id: { in } }`); `transaction/service.ts:22-25`
(`findFirst { id, userId }`), `:34-36` (`findFirst { id, userId }`),
`:156-162` (both `findMany` and `count` share the one `where` built by
`transactionWhere`, whose first key is an unconditional `userId` —
`transaction/service.ts:122`); `summary/service.ts:53-62` (both `groupBy` calls
`where: { userId, … }`). Writes: `category/service.ts:72` and
`transaction/service.ts:48` set `userId` on the created row;
`category/service.ts:98-99` and `transaction/service.ts:72-73` use
`updateMany({ where: { id, userId } })` and treat `count === 0` as `NOT_FOUND`;
`category/service.ts:121` and `transaction/service.ts:93-95` use
`deleteMany({ where: { id, userId } })`. **There is no `update` or `delete` by
`id` alone anywhere in the three services** — the fetch-then-check pattern the
checklist warns about does not appear. `auth/service.ts:65-68` follows the same
`updateMany` shape for `updateProfile`, which takes no id at all. Every resolver
obtains its `userId` through `requireUser` (`shared/auth-guard.ts:9-12`); the
only two resolvers without it are `signUp` and `signIn`
(`auth/resolvers.ts:11-12`), correctly.

**2. Cross-user tests — every operation has one.**
`categories` → `category.test.ts:113`. `categoryStats` →
`category-stats.test.ts:178`. `createCategory` (same name for two users is
allowed) → `category-service.test.ts:57`. `updateCategory` →
`category.test.ts:242` and `category-service.test.ts:227`. `deleteCategory` →
`category.test.ts:290` and `category-service.test.ts:270` (which also asserts
the row survives). `transactions` → `transaction.test.ts:190` and, through a
filter, `:372` and `transaction-filter.test.ts:201,215`; pagination counts →
`transaction-pagination.test.ts:98`. `createTransaction` with a foreign
`categoryId` → `transaction.test.ts:473` and `transaction-service.test.ts:71`.
`updateTransaction` → `transaction.test.ts:529`, plus moving into a foreign
category at `:543`. `deleteTransaction` → `transaction.test.ts:586`. `summary`
→ `summary.test.ts:184,289`. `me` → `auth.test.ts:232`. `updateProfile` →
`auth.test.ts:288`. Field resolvers: `Transaction.category` →
`category-loader.test.ts:76`; `Category.transactionCount`/`totalAmount` →
`category-stats.test.ts:66`. No operation is missing one.

**3. DataLoader scoping — correct, with one untested invariant.**
`shared/dataloaders.ts:27` — `createLoaders(userId)` is a factory; there is no
module-level instance, and the only production call site is
`src/context.ts:31`, inside `createContext`, which Apollo invokes per request
(`src/app.ts:30`). Both batch functions filter by the captured `userId` rather
than trusting the key: `dataloaders.ts:35` (`where: { userId, categoryId: { in } }`)
and `:69` (`where: { userId, id: { in } }`), and both short-circuit to a
neutral value when `userId` is null (`:31`, `:66`). The one gap is a test one:
`tests/integration/context.test.ts:14-52` asserts each context *has* loaders but
never asserts that two `createContext` calls return *different* instances. The
CLAUDE.md gotcha list flags this exact invariant as having already cost time,
and nothing currently guards it. Not raised as a numbered finding because the
code is correct and the missing assertion is a one-line addition
(`expect(a.loaders.categoryTotals).not.toBe(b.loaders.categoryTotals)`), but it
is worth adding.

**6. Password hashing — argon2id at the OWASP baseline, constant-time compare.**
`shared/password.ts:1` uses `@node-rs/argon2` v2.0.2. The defaults were measured
rather than assumed: `rtk proxy "node …/argon.mjs"` →
`encoded: $argon2id$v=19$m=19456,t=2,p=1` — Argon2id, 19 MiB, two passes, one
lane, which is the OWASP minimum. Salts are per-hash
(`tests/unit/password.test.ts:13-20` asserts two hashes of the same password
differ). `verify` at `password.ts:11` is argon2's own comparison, which is
constant-time; the `catch` at `:12-17` turns a malformed stored hash into
`false` rather than a crash. The response-time channel is sec-05, above; the
error codes themselves are identical for both failure modes
(`auth/service.ts:42,45`, asserted at `auth.test.ts:175,186`).

**9. CORS — environment-driven, single origin, correctly rejecting.**
`src/app.ts:28` — `cors({ origin: [env.CORS_ORIGIN], credentials: true })`. The
value comes from `env.CORS_ORIGIN` (`shared/env.ts:7`, `z.url()` with a
localhost default) and is passed as an array, so `cors` matches rather than
echoes. Verified: `8. ACAO for evil origin: null | for allowed origin: http://localhost:5173`
— a request from `https://evil.example` gets no
`Access-Control-Allow-Origin` header at all. `credentials: true` is presently
inert, since the token travels in an `Authorization` header and no cookie is
set (sec-07); it is harmless here only because the origin is a concrete
single-entry list — it would be dangerous the day someone changes `origin` to
`true` or a reflector.

**11. Money representation — no float path anywhere.**
`prisma/schema.prisma:39` stores `amount Int // cents`; `summary/service.ts:66-70`
and `dataloaders.ts:45` do integer addition and subtraction on the `groupBy`
sums only. On the frontend, `lib/currency.ts:20-27` builds the display string
out of the integer's digits — `padStart(3, '0')` then `slice` — explicitly
avoiding `/ 100`, and `:35-42` reads it back by stripping non-digits. They are
a genuine inverse pair, asserted at `frontend/src/lib/currency.test.ts:21,78`.
`grep -rnE "toFixed|parseFloat|/ ?100|\* ?100" frontend/src backend/src`
returns no arithmetic on amounts — the only `Number(...)` calls are on the
already-split integer parts (`currency.ts:26,41`) and on a page number
(`useTransactionFilters.ts:82`). No cent can be lost. The one integer problem is
sec-03, which is an overflow, not a rounding error.

**12. Migration drift — none.**
command: `rtk proxy "npx prisma migrate diff --from-migrations backend/prisma/migrations --to-schema-datamodel backend/prisma/schema.prisma --shadow-database-url file:./shadow.db --exit-code"`
→ `No difference detected.` Read by hand as well: the
`@@unique([userId, name])` and `@@index([userId])` at
`prisma/schema.prisma:33-34` correspond to `Category_userId_name_key` and
`Category_userId_idx`, and the `@@index([userId, date])` / `@@index([categoryId])`
at `:50-51` to `Transaction_userId_date_idx` and `Transaction_categoryId_idx`,
all four in `migrations/20260803190510_add_category_and_transaction/migration.sql`.
Cascade behaviour matches too (`ON DELETE CASCADE` for `userId`,
`ON DELETE SET NULL` for `categoryId`). The `shadow.db` the command left at the
repository root was deleted; `rtk proxy "git status --porcelain"` → empty.

**13. Input validation reaching Prisma — validation is always first.**
Every mutating and reading service function calls `parseInput` on line one, and
no Prisma call precedes it: `category/service.ts:68` before `:69`/`:72`, `:89`
before `:94`; `transaction/service.ts:45` before `:46`/`:48`, `:65` before
`:69`; `summary/service.ts:49` before `:52`; `auth/service.ts:23` before `:25`,
`:36` before `:38`, `:60` before `:65`. `listTransactions` parses at `:152`
before building the `where` at `:153`. The only values that reach Prisma
without passing through a zod schema are `userId`, which comes from a verified
JWT rather than from the request body (`context.ts:29`), and the `id` arguments
of `updateCategory`/`deleteCategory`/`updateTransaction`/`deleteTransaction`,
which are typed `ID!` by the SDL and used only inside a `where` that Prisma
parameterises — no injection path, and a nonexistent id is answered `NOT_FOUND`
by the `count === 0` checks. `shared/validation.ts:12-23` is the single
chokepoint and it throws before returning on failure. No unvalidated path found.

---

# Financy

A personal finance application for organizing, managing and categorizing income
and expenses.

Two applications sharing one domain model: a GraphQL API ([`backend/`](backend))
and a React client ([`frontend/`](frontend)). The interface is in Brazilian
Portuguese; the code, comments and documentation are in English.

## Running it locally

Requires **Node 20 or newer**. Nothing else — the database is SQLite, so there
is no Docker, no service to start and no credentials to obtain.

```bash
# 1. Install every workspace from the repository root
npm install

# 2. Configure both applications
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Set a signing secret — the API refuses to boot without one
#    (macOS/Linux; on Windows use any random 64-character hex string)
echo "JWT_SECRET=$(openssl rand -hex 32)" >> backend/.env

# 4. Create the database and load demo data
npm run db:migrate -w backend
npm run db:seed -w backend

# 5. Start both applications
npm run dev
```

| | |
|---|---|
| Frontend | http://localhost:5173 |
| GraphQL API and Apollo Sandbox | http://localhost:4000/graphql |
| Health check | http://localhost:4000/health |

`npm run dev` runs both processes in one terminal, prefixing each line with the
process it came from. Ctrl-C stops both. To run one alone: `npm run dev:backend`
or `npm run dev:frontend`.

### Signing in

Step 4 seeds one user with 7 categories and 27 transactions spread across twelve
months, so the dashboard, the filters and the pagination all have something real
to show on the first load.

```
E-mail:  ana@financy.dev
Senha:   trocar-esta-senha
```

The password comes from `SEED_PASSWORD` in `backend/.env`; the value above is
the development placeholder shipped in `.env.example`. Creating a fresh account
through the sign-up screen works too — it just starts empty.

### A short tour

| Route | What to look at |
|---|---|
| `/` | Signed out, the login screen. Signed in, the dashboard: total balance, income and expenses for the current month, recent transactions and the categories with the largest totals. |
| `/transactions` | The full table, paginated. Search by description, filter by type, category and period; the filter state lives in the URL, so a filtered view can be reloaded or shared. Create, edit and delete from the same screen. |
| `/categories` | Category cards with their icon, color and total. Create, edit and delete. Deleting a category keeps its transactions and leaves them uncategorized. |
| `/profile` | Edit the display name and sign out. The e-mail is immutable. |
| `/style-guide` | Every design-system primitive in every state — buttons, inputs, dialogs, the color and icon galleries. |

Deleting anything asks for confirmation first. Every screen implements its
loading, empty, error and populated states.

## What is implemented

| Capability | Where |
|---|---|
| Sign up and sign in | `signUp` / `signIn` mutations, JWT; `/` and `/signup` |
| Own profile, viewable and editable | `me` / `updateProfile`; `/profile` |
| Create, edit, delete and list transactions | `transactions` query with offset pagination, `createTransaction`, `updateTransaction`, `deleteTransaction`; `/transactions` |
| Create, edit, delete and list categories | `categories`, `createCategory`, `updateCategory`, `deleteCategory`; `/categories` |
| Search and filtering | `TransactionFilter` — description search, type, category, date range; the filter bar on `/transactions` |
| Aggregates for the dashboard | `summary` and `categoryStats`; `/` |
| A user only ever sees their own data | Every query and mutation filters by the authenticated user **in the `where` clause**, with a test per operation asserting `NOT_FOUND` for a cross-user access |

Deliberately out of scope: accounts, budgets, investment tracking, bank
integration, multi-currency, shared access and tax reporting. Password recovery
is deferred; both specs document what implementing it would require.

## Verifying it

```bash
npm test                            # 600 tests: 276 backend, 324 frontend
npm run typecheck                   # tsc --noEmit, strict, no `any` outside generated/
npm run lint
npm run format:check
npm run codegen:check -w backend    # the committed SDL matches the served schema
npm run codegen:check -w frontend   # the generated hooks match the operations
```

The test suites need no `.env` and no running server: each workspace's vitest
config declares its own environment, and the backend applies migrations to a
separate `test.db` before the suite runs, so running the tests never touches the
development database.

The weight is on integration tests. The backend executes real GraphQL operations
against a real SQLite file; the frontend renders real screens against a mocked
network layer (MSW, configured to fail on any unmocked request).

## Stack

| | Backend | Frontend |
|---|---|---|
| Language | TypeScript, `strict` | TypeScript, `strict` |
| Core | GraphQL (Apollo Server 4), Express | React 19, Vite |
| Data | Prisma, SQLite | TanStack Query, generated typed hooks |
| Auth | JWT (`jose`), argon2id password hashing | Session context, route guards |
| Validation | zod | zod + react-hook-form |
| Styling | — | Tailwind CSS 4, `lucide-react` icons |
| Tests | Vitest + supertest | Vitest + Testing Library + MSW |

TypeScript, GraphQL, Prisma and SQLite were fixed up front; every other choice,
and the reasoning behind it, is in [`docs/specs/backend.md`](docs/specs/backend.md)
and [`docs/specs/frontend.md`](docs/specs/frontend.md).

## Domain model

```
User
 └── Transaction   type: INCOME | EXPENSE
      ├── amount, date, description
      └── Category (optional)   e.g. "Mercado", "Salário"
```

- **User** — owns everything. All data is scoped to its owner.
- **Transaction** — a single movement of money, either `INCOME` or `EXPENSE`.
  Amounts are stored as integer cents and converted at the edges, so no rounding
  error can accumulate.
- **Category** — a user-defined label with an icon and a color. A transaction may
  have none, and deleting a category leaves its transactions in place,
  uncategorized.

## Repository structure

```
financy/
├── backend/                      # GraphQL API
│   ├── prisma/                   # schema, migrations, seed
│   ├── src/modules/              # auth, category, transaction, summary — one folder each,
│   │                             #   holding its schema, resolvers, service and validation
│   ├── src/shared/               # errors, auth guard, env validation, JWT, password
│   │                             #   hashing, Prisma client, DataLoaders
│   ├── src/app.ts, server.ts     # app.ts builds the Express app; server.ts binds the port
│   ├── tests/                    # integration/, unit/, helpers/, setup/
│   └── schema.graphql            # printed from the module SDL by codegen, committed
├── frontend/
│   └── src/
│       ├── components/ui/        # design-system primitives, browsable at /style-guide
│       ├── components/layout/    # app shell, top bar, route guards
│       ├── features/             # auth, categories, dashboard, profile, transactions —
│       │                         #   each screen with its own dialogs, hooks and validation
│       ├── pages/                # screens belonging to no feature (the style guide)
│       ├── graphql/              # .graphql operations and the generated typed hooks
│       ├── lib/                  # client, currency, formatting, category tokens
│       ├── test/                 # render helper, MSW handlers, vitest setup
│       └── index.css             # the theme; no color literal exists outside this file
└── docs/
    ├── specs/                    # backend.md, frontend.md — the source of truth for behavior
    └── plans/                    # the roadmap and the per-slice implementation plans
```

Both applications are organized **by feature, not by file type**: a change to one
screen means opening one directory.

## How it was built

Five vertical slices, each one delivering a working feature across both
applications rather than a layer across the whole app, each merged through its
own pull request. [`docs/plans/roadmap.md`](docs/plans/roadmap.md) has the
order and the definition of done that every slice was reviewed against; the
`slice-N-outcome.md` files record what actually shipped and where it diverged
from the plan.

- [x] Slice 0 — Foundations
- [x] Slice 1 — Auth and profile
- [x] Slice 2 — Categories
- [x] Slice 3 — Transactions
- [x] Slice 4 — Search and filters
- [x] Slice 5 — Dashboard

`main` holds the complete solution. The `feat/slice-*` branches are kept as the
history of how it got there.

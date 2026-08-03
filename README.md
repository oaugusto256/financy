# Financy

A personal finance application for organizing, managing and categorizing income
and expenses.

## Overview

Most people know roughly how much they earn and spend, but not *where* the money
goes. Financy exists to close that gap: record every inflow and outflow, attach a
meaningful category to each one, and turn the resulting history into a picture
that is actually useful for making decisions.

The product is built as two applications — a backend API and a frontend client —
that share a single domain model.

## Goals

- Let a user sign up and sign in, and see only their own data.
- Record income and expenses with amount, date, description and category.
- Organize transactions into user-defined categories, each with its own icon and
  color, so spending can be grouped in whatever way makes sense to the person
  using it.
- Search and filter transactions by description, category, type and period.
- Show where the money went: balance, income and expenses for the month, and
  totals per category.

## Non-goals

These are deliberately out of scope. Some may become goals later; none of them
shape the current design.

- **Accounts.** Transactions are not grouped under checking, savings or credit
  card accounts.
- **Budgets.** No per-category spending limits or planned-versus-actual tracking.
- **Investment portfolio tracking.** No holdings, quotes, average price or
  returns. Financy tracks cash flow, not assets under management.
- **Bank integration.** No Open Finance, no scraping, no automatic import from
  financial institutions.
- **Multi-currency.** A single currency per user.
- **Shared access.** Each user sees only their own data.
- **Tax reporting.** No fiscal calculations or statement generation.

## Domain model

Three entities. See [`docs/specs/backend.md`](docs/specs/backend.md) for the
precise schema.

```
User
 └── Transaction   type: INCOME | EXPENSE
      ├── amount, date, description
      └── Category (optional)   e.g. "Groceries", "Salary"
```

- **User** — owns everything. All data is scoped to its owner.
- **Transaction** — a single movement of money, either `INCOME` or `EXPENSE`.
  The central entity of the system.
- **Category** — a user-defined label for grouping transactions. Categories are
  what make the history readable. A transaction may have none, and deleting a
  category leaves its transactions in place, uncategorized.

## Repository structure

```
financy/
├── README.md
├── docs/
│   └── specs/            # backend.md, frontend.md — the source of truth
├── apps/
│   ├── backend/          # API
│   └── frontend/         # client
└── packages/             # reserved for code shared between the two apps
```

`packages/` is a placeholder. It only gets used if the two specs agree on
something genuinely worth sharing, such as domain types.

## Stack

- **Backend** — TypeScript, GraphQL (Apollo Server), Prisma, SQLite, JWT auth.
  See [`docs/specs/backend.md`](docs/specs/backend.md).
- **Frontend** — TypeScript, React, Vite, GraphQL, TanStack Query, Tailwind CSS.
  See [`docs/specs/frontend.md`](docs/specs/frontend.md).

The specs are the source of truth for stack, features and constraints. This
README stays a high-level overview.

## Status

Slice 1 of 5 complete: a person can create an account, sign in, edit their
profile and sign out.
See [`docs/plans/roadmap.md`](docs/plans/roadmap.md) for the plan.

- [x] Backend spec
- [x] Frontend spec
- [x] Slice 0 — Foundations
- [x] Slice 1 — Auth and profile
- [ ] Slice 2 — Categories
- [ ] Slice 3 — Transactions
- [ ] Slice 4 — Search, filters, pagination
- [ ] Slice 5 — Dashboard

Password recovery is deferred to phase 2 and is documented in both specs.

## Running locally

Requires Node 20 or newer.

```bash
npm install
cp apps/backend/.env.example apps/backend/.env   # then fill in JWT_SECRET
cp apps/frontend/.env.example apps/frontend/.env
npm run db:migrate -w @financy/backend

npm run dev            # both, in one terminal
```

`npm run dev` runs the backend on `http://localhost:4000/graphql` and the
frontend on `http://localhost:5173`, prefixing each line with the process it
came from. Ctrl-C stops both. To run one alone, `npm run dev:backend` or
`npm run dev:frontend`.

The design system is browsable at `/style-guide`.

## Checks

```bash
npm test          # both workspaces
npm run typecheck
npm run lint
npm run format:check
npm run codegen:check -w @financy/backend    # must report no diff
npm run codegen:check -w @financy/frontend
```

The test suites need no `.env` and no running server: each workspace's vitest
config declares its own environment, and the backend applies migrations to a
separate `test.db` before the suite runs.

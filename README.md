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
- Organize transactions into user-defined categories, so spending can be grouped
  in whatever way makes sense to the person using it.
- Filter transactions by category, type and date range.

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
- **Frontend** — TBD, to be defined in `docs/specs/frontend.md`.

The specs are the source of truth for stack, features and constraints. This
README stays a high-level overview.

## Status

Design phase. Specs are written before code.

- [x] Backend spec
- [ ] Frontend spec
- [ ] Implementation

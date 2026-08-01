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

- Record income and expenses with amount, date, description and category.
- Organize transactions into user-defined categories, so spending can be grouped
  in whatever way makes sense to the person using it.
- Group transactions under accounts (checking, savings, credit card, cash).
- Set budgets per category and per period, and see how actual spending compares.
- Provide a clear summary of a period: total in, total out, balance, and a
  breakdown by category.

## Non-goals

These are deliberately out of scope. Some may become goals later; none of them
shape the current design.

- **Investment portfolio tracking.** No holdings, quotes, average price or
  returns. Financy tracks cash flow, not assets under management.
- **Bank integration.** No Open Finance, no scraping, no automatic import from
  financial institutions in the initial version.
- **Multi-currency.** A single currency per user.
- **Shared or multi-user accounts.** Each user sees only their own data.
- **Tax reporting.** No fiscal calculations or statement generation.

## Domain model

A first sketch, to be refined and made precise by the backend spec.

```
User
 └── Account            e.g. "Checking", "Credit card"
      └── Transaction   type: INCOME | EXPENSE
           ├── amount, date, description
           └── Category e.g. "Groceries", "Salary"

Budget                  a limit for one Category over one period
```

- **Account** — where money sits or moves through. Every transaction belongs to
  exactly one account.
- **Transaction** — a single movement of money, either `INCOME` or `EXPENSE`.
  The central entity of the system.
- **Category** — a user-defined label for grouping transactions. Categories are
  what make the history readable.
- **Budget** — an expected limit for a category over a period, used to compare
  planned versus actual spending.

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

**TBD.** Neither stack has been chosen yet.

- **Backend** — to be defined in `docs/specs/backend.md`.
- **Frontend** — to be defined in `docs/specs/frontend.md`.

Once those specs exist, they are the source of truth for stack, features and
constraints. This README stays a high-level overview.

## Status

Early design phase. Specs are written before code: the backend spec first, then
the frontend spec, then implementation.

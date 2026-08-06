# Backend Spec

Status: approved, implemented through slice 4
Last updated: 2026-08-06 (slice 4: section 2 notes that `%` and `_` in a
search term are unescaped `LIKE` wildcards, section 5 states `TransactionFilter`'s
optionality, AND-combination, inclusive date bounds and the empty-page
behavior for another user's `categoryId`, and section 7 notes that an empty
string and `null` both mean "no filter" in a filter, unlike `categoryId` in
`UpdateTransactionInput`)

The Financy API manages a user's personal finances: authentication, transactions
and categories. This document is the source of truth for what the backend does
and how it is built. Where it conflicts with the root README, this document wins.

## 1. Scope

### In scope

- A user can sign up and sign in.
- A user can view and update their own profile.
- A user can see and manage only the transactions and categories they created.
- Create, edit, delete and list transactions, with search and filtering.
- Create, edit, delete and list categories.
- Aggregate figures for the dashboard and the categories screen.

### Out of scope

`Account` and `Budget` are not part of this system. Neither is investment
tracking, bank integration, multi-currency or shared access. The domain is two
owned entities — transactions and categories — plus the users that own them.

Password recovery is deferred to phase 2. See section 11.

### Amendments from the frontend design

The frontend design (`frontend.md`) required capabilities this spec did not
originally include. They are now part of it: `User.name` and profile updates,
`Category.description` and `Category.icon`, a constrained `CategoryColor`, per
category aggregates, dashboard summary figures, and description search. Each is
marked in place below.

## 2. Stack

Mandatory, imposed by the project requirements:

| Concern | Choice |
|---|---|
| Language | TypeScript |
| API | GraphQL |
| ORM | Prisma |
| Database | SQLite |

Chosen to fill in the rest:

| Concern | Choice | Reason |
|---|---|---|
| GraphQL server | Apollo Server 4, schema-first | Explicit SDL, readable as documentation |
| Resolver typing | graphql-codegen (`typescript-resolvers`) | Keeps hand-written SDL and resolvers in sync |
| HTTP layer | Express + Apollo express middleware | Explicit CORS control and a health endpoint |
| Password hashing | argon2id | Memory-hard; current recommended default |
| Validation | zod | Same library for input and environment validation |
| Tests | Vitest | Integration tests against a real SQLite file |

### SQLite constraint

**Prisma does not support `enum` on SQLite.** `Transaction.type`,
`Category.color` and `Category.icon` are therefore stored as `String`. Each enum
exists where it can be enforced:

- in the GraphQL schema, as `TransactionType`, `CategoryColor` and `CategoryIcon`
- in TypeScript, as union types
- in the service layer, validated by zod before any write

A future move to Postgres converts these columns to native enums without
changing the public API.

**Prisma's `mode: "insensitive"` is also unsupported on SQLite.** Description
search therefore relies on SQLite's `LIKE`, which is already case-insensitive for
ASCII. This is adequate for the search box in the design, with one known limit
worth writing down: it does not fold accents, so "cafe" will not match "café".
Moving to Postgres replaces this with an explicit case-insensitive filter.

A second limit sits beside it: `%` and `_` inside a search term are `LIKE`
wildcards, not literal characters — `%` matches any run of characters and `_`
matches any single one. Prisma's `contains` emits no `ESCAPE` clause, so a
search for "50% off" also matches "50XYZ off" for any characters in place of
the `%`, and "a_b" matches "axb" for any single character in place of the
`_`. Escaping them is possible, but only by dropping to `prisma.$queryRaw` for
this one query; not done here.

## 3. Architecture

Three layers, with dependencies pointing inward only:

```
GraphQL resolvers  →  services  →  Prisma
   (transport)      (business)     (data)
```

**Resolvers** extract `userId` from the request context, call a service, and
translate domain errors into GraphQL errors. They contain no business rules and
never call Prisma directly.

**Services** hold the business rules. They take `userId` as an explicit first
argument and never read request context. Two consequences, both deliberate:
services are testable without starting a server, and ownership is visible in
every signature rather than being an easily forgotten side effect.

**Prisma** is the only thing that touches the database.

Code is organized by module, not by file type. Each module keeps its SDL,
resolvers, service and validation together.

```
apps/backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── modules/
│   │   ├── auth/          schema.ts, resolvers.ts, service.ts, validation.ts
│   │   ├── category/      same
│   │   └── transaction/   same
│   ├── shared/            errors.ts, auth-guard.ts, dataloaders.ts, env.ts,
│   │                      password.ts, jwt.ts, prisma.ts
│   ├── graphql/generated/ resolver types, written by codegen
│   ├── context.ts
│   ├── schema.ts          merges module SDL
│   └── server.ts
├── tests/
├── schema.graphql         the printed schema, committed for the frontend
├── .env.example
└── codegen.ts
```

A module's SDL is a template literal tagged with the `/* GraphQL */` comment in
`schema.ts`, not a `.graphql` file. Reading SDL at runtime would mean the build
has to copy non-TypeScript files into `dist/`, and graphql-codegen plucks the
SDL out of the magic comment just as happily.

## 4. Data model

```prisma
model User {
  id           String        @id @default(uuid())
  name         String
  email        String        @unique
  passwordHash String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  categories   Category[]
  transactions Transaction[]
}

model Category {
  id           String        @id @default(uuid())
  name         String
  description  String?
  icon         String        // CategoryIcon token
  color        String        // CategoryColor token
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@unique([userId, name])
  @@index([userId])
}

model Transaction {
  id          String    @id @default(uuid())
  description String
  amount      Int       // cents
  type        String    // "INCOME" | "EXPENSE"
  date        DateTime
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId, date])
  @@index([categoryId])
}
```

### Decisions

**Money is an integer number of cents.** Binary floating point cannot represent
`0.10` exactly, so summing a hundred ten-cent transactions does not produce ten
reais. Money in floating point is a guaranteed bug with an unknown arrival date.
Integer cents sum and sort exactly in the database. Conversion to a decimal
representation happens at the edge: the API exposes `Int` cents, and formatting
is the frontend's concern.

**Deleting a category unlinks its transactions** (`onDelete: SetNull`,
`categoryId` nullable). Those transactions become uncategorized; no financial
history is lost. History is the most valuable thing in this system, and a
cascading delete would destroy it from a single misclick.

**Only `Transaction` carries a type.** Categories are neutral and reusable across
income and expense, which removes an entire class of compatibility validation.

**Category names are unique per user** (`@@unique([userId, name])`). Scoped to
the owner, so two users can each have a "Groceries" without colliding.

**Deleting a user cascades** to their categories and transactions. A deleted
account leaves no orphaned financial records.

**`icon` and `color` are closed sets of tokens, not free values.** The database
stores `GREEN` or `UTENSILS`, never `#16A34A` or an SVG path. The mapping from
token to hex and to a Lucide icon component lives in the frontend theme, so
restyling the palette never requires a data migration. Free-form hex would also
allow colors that fail contrast against the tag background.

**`icon` is required, `color` is required, `description` is optional.** This
matches the category dialog, where the icon and color pickers both have a
default selection and the description field is explicitly labelled optional.

## 5. GraphQL API

```graphql
scalar DateTime

enum TransactionType {
  INCOME
  EXPENSE
}

enum CategoryColor {
  GREEN
  BLUE
  PURPLE
  PINK
  RED
  ORANGE
  YELLOW
}

enum CategoryIcon {
  BRIEFCASE
  BUS
  HEART_PULSE
  PIGGY_BANK
  SHOPPING_CART
  TICKET
  GIFT
  UTENSILS
  BIKE
  HOME
  HAND_COINS
  BOOK_OPEN
  STORE
  WALLET
  CREDIT_CARD
  RECEIPT
}

type User {
  id: ID!
  name: String!
  email: String!
  createdAt: DateTime!
}

type Category {
  id: ID!
  name: String!
  description: String
  icon: CategoryIcon!
  color: CategoryColor!
  transactionCount: Int!   # transactions in this category
  totalAmount: Int!        # sum of their amounts, in cents
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Summary {
  totalBalance: Int!   # all-time income minus expense, in cents
  monthIncome: Int!    # income within the requested month
  monthExpense: Int!   # expense within the requested month
}

type CategoryStats {
  totalCategories: Int!
  totalTransactions: Int!   # includes uncategorized transactions
  mostUsed: Category        # null when the user has no transactions
}

type Transaction {
  id: ID!
  description: String!
  amount: Int!            # cents
  type: TransactionType!
  date: DateTime!
  category: Category      # null once its category is deleted
  createdAt: DateTime!
  updatedAt: DateTime!
}

type AuthPayload {
  token: String!
  user: User!
}

type TransactionPage {
  items: [Transaction!]!
  totalCount: Int!
}

input SignUpInput { name: String!, email: String!, password: String! }
input SignInInput { email: String!, password: String! }

input UpdateProfileInput { name: String! }

input CreateCategoryInput {
  name: String!
  description: String
  icon: CategoryIcon!
  color: CategoryColor!
}

input UpdateCategoryInput {
  name: String
  description: String
  icon: CategoryIcon
  color: CategoryColor
}

input CreateTransactionInput {
  description: String!
  amount: Int!
  type: TransactionType!
  date: DateTime!
  categoryId: ID
}

input UpdateTransactionInput {
  description: String
  amount: Int
  type: TransactionType
  date: DateTime
  categoryId: ID
}

input TransactionFilter {
  search: String        # case-insensitive substring of description
  type: TransactionType
  categoryId: ID
  dateFrom: DateTime
  dateTo: DateTime
}

type Query {
  me: User!
  summary(month: Int!, year: Int!): Summary!
  categories: [Category!]!
  categoryStats: CategoryStats!
  transactions(
    filter: TransactionFilter
    limit: Int = 10
    offset: Int = 0
  ): TransactionPage!
}

type Mutation {
  signUp(input: SignUpInput!): AuthPayload!
  signIn(input: SignInInput!): AuthPayload!
  updateProfile(input: UpdateProfileInput!): User!

  createCategory(input: CreateCategoryInput!): Category!
  updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
  deleteCategory(id: ID!): Boolean!

  createTransaction(input: CreateTransactionInput!): Transaction!
  updateTransaction(id: ID!, input: UpdateTransactionInput!): Transaction!
  deleteTransaction(id: ID!): Boolean!
}
```

`User.passwordHash` is absent from the schema by design — a field that does not
exist cannot be queried.

`categories` returns a plain list because the number of categories per user is
naturally small. `transactions` is paginated from the start because it grows
without bound. Pagination is offset-based rather than cursor-based: the frontend
needs "page 3" and date-range filtering, not infinite scroll. Default ordering is
`date DESC`, then `createdAt DESC` as a tiebreaker so ordering is stable.

The default `limit` is 10, matching the transactions table in the design
("1 a 10 | 27 resultados"). It is clamped to a maximum of 100 regardless of what
the client sends.

Every field of `TransactionFilter` is optional, and any fields supplied
combine with AND — a request carrying both `type` and `categoryId` returns
rows matching both, not either. `dateFrom` and `dateTo` are inclusive at both
ends. A `categoryId` belonging to another user is not rejected: it returns an
empty page rather than `NOT_FOUND`, because `userId` is already part of the
same `where` clause, and answering `NOT_FOUND` would confirm the id exists.

`Transaction.category` resolves through a DataLoader batched per request, so
listing transactions does not produce one category query per row.
`Category.transactionCount` and `Category.totalAmount` do the same, resolving
through a single grouped aggregate per request rather than one query per
category.

`email` is deliberately absent from `UpdateProfileInput`. The profile screen
renders the email field disabled with the helper "O e-mail não pode ser
alterado", and email is the login identifier — changing it is an account
recovery concern, not a profile edit.

### Aggregate semantics

These are stated precisely because the dashboard is wrong in a way nobody
notices if they drift:

- `totalBalance` is all-time, not month-scoped: the sum of every `INCOME` minus
  the sum of every `EXPENSE`, across the user's whole history.
- `monthIncome` and `monthExpense` cover the requested calendar month only,
  from the first instant of day 1 to the last instant of the final day.
- `month` is 1–12. Out-of-range values are `BAD_USER_INPUT`.
- `Category.totalAmount` is the unsigned sum of that category's transactions.
  Since a category may hold both income and expense, it is a volume figure, not
  a net one — the design labels it as a plain amount next to an item count.
- `CategoryStats.totalTransactions` counts all of the user's transactions,
  including uncategorized ones, so it will not always equal the sum of every
  `transactionCount`.
- `mostUsed` is the category with the highest `transactionCount`, ties broken by
  name ascending so the result is stable between requests. It is null when no
  transaction of the user's has a category — whether because they have no
  transactions at all, or because every one of them is uncategorized.

Every aggregate is scoped to the calling user, like every other read.

## 6. Authentication and ownership

### Authentication

Stateless JWT signed with `JWT_SECRET`, sent as `Authorization: Bearer <token>`,
expiring in 7 days. There is no refresh token: the requirements define a single
secret, and session rotation is scope nobody asked for.

Passwords are hashed with argon2id. The hash never leaves the auth service.

### Ownership

This is the central security rule of the system. Every rule below is a
requirement, not a suggestion.

1. The Apollo context resolves the bearer token into a `userId` once per request.
   A missing or invalid token yields a context with no user.
2. Every authenticated resolver passes through a guard that rejects a
   user-less context before reaching any service.
3. Every read and write filters by `userId` **in the where clause**, never after
   fetching. Updates and deletes use `updateMany` / `deleteMany` scoped by
   `{ id, userId }` and check the affected count, so there is no window between
   "fetch" and "check owner".
4. `createTransaction` and `updateTransaction` verify that any supplied
   `categoryId` belongs to the same user. Otherwise a user could attach their
   transaction to someone else's category and learn that it exists.
5. Accessing another user's resource returns **`NOT_FOUND`, never `FORBIDDEN`**.
   `FORBIDDEN` would confirm that the id exists, which lets an attacker enumerate
   other users' records.

## 7. Errors

Stable machine-readable codes in `extensions.code`, so the frontend never has to
parse a message:

| Code | Meaning |
|---|---|
| `UNAUTHENTICATED` | Missing, malformed or expired token |
| `NOT_FOUND` | Resource does not exist, or is not owned by the caller |
| `BAD_USER_INPUT` | Input failed validation |
| `EMAIL_ALREADY_EXISTS` | Sign-up with an email already registered |
| `INVALID_CREDENTIALS` | Sign-in failed |

A duplicate category name has no code of its own. `@@unique([userId, name])` is
reachable from `createCategory` and `updateCategory`, and both answer
`BAD_USER_INPUT` with `fieldErrors: { name: ["Já existe uma categoria com esse
nome"] }`. A dedicated code would need frontend handling that `fieldErrors`
already provides, and the message belongs on the field either way.

`INVALID_CREDENTIALS` is returned identically for an unknown email and a wrong
password. Distinguishing them would turn the login endpoint into an oracle for
which emails have accounts.

In production, unexpected errors are logged server-side and returned as a generic
message with no stack trace.

### Validation rules

Enforced by zod at the entry point of each service:

- `name` (user) — non-empty after trimming, maximum 100 characters
- `email` — valid format, normalized to lowercase
- `password` — minimum 8 characters
- `description` (transaction) — non-empty after trimming, max 200 characters
- `amount` — integer of centavos, strictly positive. The sign is not
  used; `type` carries the direction.
- `type` — `INCOME` or `EXPENSE`
- `date` — a valid date
- `name` (category) — non-empty after trimming, maximum 50 characters
- `description` (category) — optional; maximum 200 characters
- `icon` — one of the `CategoryIcon` tokens
- `color` — one of the `CategoryColor` tokens
- category name uniqueness — scoped to the owner; a collision is
  `BAD_USER_INPUT` on the `name` field
- `search` — maximum 100 characters
- in a `TransactionFilter`, an empty string and `null` both mean "no filter on
  that field" — unlike `categoryId` in `UpdateTransactionInput`, where an
  empty string means "clear it"
- `month` — integer 1–12; `year` — integer 1970–2100
- pagination — `limit` is an integer of at least 1 and `offset` an integer of at
  least 0; either below its minimum is `BAD_USER_INPUT`. A `limit` above 100 is
  clamped to 100 rather than rejected, since §5 holds the maximum "regardless of
  what the client sends".

## 8. Configuration

`.env.example` is committed; `.env` is ignored.

```
DATABASE_URL="file:./dev.db"
JWT_SECRET=
PORT=4000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
# Password for the seed user (prisma/seed.ts). Development-only; do not set in
# any deployed environment.
SEED_PASSWORD=trocar-esta-senha
```

Environment variables are validated with zod at startup. If `JWT_SECRET` is
missing or empty, the process exits immediately with a clear message. A server
that boots with an empty signing secret issues tokens anyone can forge, and it
fails silently — so it must fail loudly instead.

Any variable added later must be added to `.env.example` in the same change.

CORS is enabled through the Express `cors` middleware, restricted to
`CORS_ORIGIN` with credentials allowed. Not `*`.

## 9. Testing

Vitest, with the weight on **integration tests** that execute real GraphQL
operations against a dedicated SQLite test database, reset between tests. Unit
tests are used only where there is pure logic worth isolating, such as validation.

Coverage expectations:

- Every mutation and query, in both success and failure paths.
- Auth: sign-up with a duplicate email, sign-in with wrong credentials, requests
  with missing and expired tokens.
- A dedicated ownership block: user A cannot read, edit or delete user B's
  transactions or categories, and cannot attach a transaction to B's category —
  one test per operation. This is the rule that breaks silently if it breaks.
- Deleting a category leaves its transactions in place with a null category.
- Pagination and each filter in `TransactionFilter`, including search.
- Aggregates: `summary` for a month with no transactions returns zeros;
  `totalBalance` spans months; `categoryStats.mostUsed` is null for a new user
  and breaks ties by name; `totalTransactions` still counts uncategorized rows.
- `updateProfile` changes the name and cannot change the email.

## 10. Seed

`prisma/seed.ts` creates one test user with a set of categories and roughly
thirty transactions spread across two months. The frontend needs realistic data
to build the dashboard, pagination and filters against, and a fixed seed makes
screenshots reproducible.

The seed password comes from the `SEED_PASSWORD` environment variable,
falling back to a non-secret placeholder when unset, and the file makes clear
it is for development only.

## 11. Phase 2

Deliberately deferred. Not implemented in the first version.

**Password recovery.** The login screen in the Figma file has a "Recuperar
senha" link. Implementing it requires a `PasswordResetToken` model,
`requestPasswordReset` and `resetPassword` mutations, an email delivery
dependency with its own environment variables, and two frontend pages that the
design does not include. When it is built, three rules are not optional: the
reset token is stored hashed rather than in plaintext, it is single-use and
short-lived, and `requestPasswordReset` returns the same response whether or not
the email exists — otherwise it becomes a way to discover who has an account.

Until then, the frontend does not render the link. See `frontend.md`, section on
deviations from the design.

## 12. Open items

None. Every decision needed to write the implementation plan is recorded above.

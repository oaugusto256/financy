# Backend Spec

Status: approved, not implemented
Last updated: 2026-08-01

The Financy API manages a user's personal finances: authentication, transactions
and categories. This document is the source of truth for what the backend does
and how it is built. Where it conflicts with the root README, this document wins.

## 1. Scope

### In scope

- A user can sign up and sign in.
- A user can see and manage only the transactions and categories they created.
- Create, edit, delete and list transactions.
- Create, edit, delete and list categories.

### Out of scope

`Account` and `Budget` are not part of this system. Neither is investment
tracking, bank integration, multi-currency or shared access. The domain is two
owned entities — transactions and categories — plus the users that own them.

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

**Prisma does not support `enum` on SQLite.** `Transaction.type` is therefore
stored as `String`. The enum exists where it can be enforced:

- in the GraphQL schema, as `enum TransactionType { INCOME EXPENSE }`
- in TypeScript, as a union type
- in the service layer, validated by zod before any write

A future move to Postgres converts the column to a native enum without changing
the public API.

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
│   └── seed.ts
├── src/
│   ├── modules/
│   │   ├── auth/          schema.graphql, resolvers.ts, service.ts, validation.ts
│   │   ├── category/      same
│   │   └── transaction/   same
│   ├── shared/            errors.ts, auth-guard.ts, dataloaders.ts, env.ts
│   ├── context.ts
│   ├── schema.ts          merges module SDL
│   └── server.ts
├── tests/
├── .env.example
└── codegen.ts
```

## 4. Data model

```prisma
model User {
  id           String        @id @default(uuid())
  email        String        @unique
  passwordHash String
  createdAt    DateTime      @default(now())
  categories   Category[]
  transactions Transaction[]
}

model Category {
  id           String        @id @default(uuid())
  name         String
  color        String?
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

## 5. GraphQL API

```graphql
scalar DateTime

enum TransactionType {
  INCOME
  EXPENSE
}

type User {
  id: ID!
  email: String!
  createdAt: DateTime!
}

type Category {
  id: ID!
  name: String!
  color: String
  createdAt: DateTime!
  updatedAt: DateTime!
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

input SignUpInput  { email: String!, password: String! }
input SignInInput   { email: String!, password: String! }

input CreateCategoryInput { name: String!, color: String }
input UpdateCategoryInput { name: String,  color: String }

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
  type: TransactionType
  categoryId: ID
  dateFrom: DateTime
  dateTo: DateTime
}

type Query {
  me: User!
  categories: [Category!]!
  transactions(
    filter: TransactionFilter
    limit: Int = 50
    offset: Int = 0
  ): TransactionPage!
}

type Mutation {
  signUp(input: SignUpInput!): AuthPayload!
  signIn(input: SignInInput!): AuthPayload!

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

`Transaction.category` resolves through a DataLoader batched per request, so
listing transactions does not produce one category query per row.

`limit` is clamped to a maximum of 100 regardless of what the client sends.

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

`INVALID_CREDENTIALS` is returned identically for an unknown email and a wrong
password. Distinguishing them would turn the login endpoint into an oracle for
which emails have accounts.

In production, unexpected errors are logged server-side and returned as a generic
message with no stack trace.

### Validation rules

Enforced by zod at the entry point of each service:

- `email` — valid format, normalized to lowercase
- `password` — minimum 8 characters
- `description` — non-empty after trimming, maximum 200 characters
- `amount` — integer, non-zero (sign is not used; `type` carries the direction)
- `type` — `INCOME` or `EXPENSE`
- `date` — a valid date
- `name` (category) — non-empty after trimming, maximum 50 characters
- `color` — optional; if present, a hex color such as `#RRGGBB`
- pagination — `limit` between 1 and 100, `offset` at least 0

## 8. Configuration

`.env.example` is committed; `.env` is ignored.

```
DATABASE_URL="file:./dev.db"
JWT_SECRET=
PORT=4000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
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
- Pagination and each filter in `TransactionFilter`.

## 10. Open items

None. Every decision needed to write the implementation plan is recorded above.

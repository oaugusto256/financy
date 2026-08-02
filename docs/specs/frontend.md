# Frontend Spec

Status: approved, not implemented
Last updated: 2026-08-01

A React application that consumes the Financy GraphQL API, letting a user manage
their transactions and categories. This document is the source of truth for the
frontend. It pairs with [`backend.md`](./backend.md), which it amended: the
design required capabilities the original API spec did not have.

The design lives in a Figma file with two relevant tabs — Style Guide and Pages.
Where this document records a value, it was read from that design. Where the two
disagree, the Figma file wins for visual detail and this document wins for
behavior.

**Figma file:** _(not yet recorded — paste the share URL here)_

Every slice's definition of done requires comparing the built screen against its
Figma frame. Without the URL in the repository, whoever picks up a slice has to
go and ask for it, and an agent executing a plan cannot reach it at all. That is
why slice 0 handed both of its Figma checks back to the repository owner.

## 1. Scope

Six pages and two dialogs.

| Page | Route | Access |
|---|---|---|
| Login | `/` | Public — shown when signed out |
| Dashboard | `/` | Private — shown when signed in |
| Sign up | `/signup` | Public |
| Transactions | `/transactions` | Private |
| Categories | `/categories` | Private |
| Profile | `/profile` | Private |

The root route is the same path serving two different screens depending on
authentication, as the requirements specify.

**Dialogs:** the transaction form and the category form. Each handles both
creation and editing — same fields, same validation, different title and
submit behavior. Building two separate components for create and edit would
duplicate every field for no gain.

## 2. Stack

Mandatory:

| Concern | Choice |
|---|---|
| Language | TypeScript |
| UI | React (no framework — Vite only) |
| Bundler | Vite |
| API | GraphQL |

Chosen:

| Concern | Choice | Reason |
|---|---|---|
| Routing | React Router | The six pages need real URLs |
| Server state | TanStack Query | Caching, invalidation and request states without hand-rolling them |
| GraphQL transport | `graphql-request` | A thin fetch wrapper; TanStack Query does the caching |
| Typed operations | graphql-codegen | Generates typed hooks from the backend schema, so a schema change breaks the build rather than production |
| Styling | Tailwind CSS | Design tokens map directly onto a theme config |
| Components | shadcn/ui | Accessible primitives (dialog, select, checkbox) that are copied into the project and restyled to the design, not fought against |
| Forms | React Hook Form | Uncontrolled inputs, so typing in a form does not re-render the page |
| Validation | zod | The same schemas as the backend, so client and server agree on what is valid |
| Dates | `date-fns` | Formatting and month boundaries without pulling in a large library |

**Why TanStack Query rather than Apollo Client.** Apollo brings a normalized
cache that can update a list after a mutation without an explicit invalidation.
That is genuinely useful at scale, and it costs a large bundle plus cache policy
configuration that is hard to debug when it misbehaves. This application has two
entities and a handful of lists. Explicit invalidation is easier to read, easier
to get right, and easier to change.

## 3. Design system

Built first, before any page. Every token below comes from the Style Guide tab.

### Color

```
brand-dark    #124B2B      brand-base    #1F6F43

gray-800      #111827      gray-400      #9CA3AF
gray-700      #374151      gray-300      #D1D5DB
gray-600      #4B5563      gray-200      #E5E7EB
gray-500      #6B7280      gray-100      #F8F9FA

black         #000000      white         #FFFFFF
danger        #EF4444      success       #19AD70
```

Seven category color families, each with a dark, base and light shade:

| Token | dark | base | light |
|---|---|---|---|
| `BLUE` | `#1D4ED8` | `#2563EB` | `#DBEAFE` |
| `PURPLE` | `#7E22CE` | `#9333EA` | `#F3E8FF` |
| `PINK` | `#BE185D` | `#DB2777` | `#FCE7F3` |
| `RED` | `#B91C1C` | `#DC2626` | `#FEE2E2` |
| `ORANGE` | `#C2410C` | `#EA580C` | `#FFEDD5` |
| `YELLOW` | `#A16207` | `#CA8A04` | `#F7F3CA` |
| `GREEN` | `#15803D` | `#16A34A` | `#E0FAE9` |

A tag uses `light` as its background and `dark` as its text; a category icon
badge uses `light` as its background and `base` as the icon color. This pairing
is what keeps text legible on every color, and it is why the backend stores a
token rather than a raw hex — see `backend.md`, section 4.

### Typography

Inter, from Google Fonts, self-hosted through `@fontsource/inter` so the app does
not depend on a third-party request at load time.

### Icons

Lucide, via `lucide-react`. The sixteen `CategoryIcon` tokens map to Lucide
components in a single lookup table. That table is the only place icon names
appear, so a token that does not resolve is a compile error rather than a blank
square.

### Components

Built and reviewed against the Style Guide before any page uses them.

| Component | States and variants |
|---|---|
| `Input` | empty, active, filled, error, disabled — with label, optional leading icon, and helper text that turns into the error message |
| `PasswordInput` | `Input` plus a visibility toggle |
| `Select` | same shell as `Input`, with a checkmark on the selected option |
| `Button` | primary (filled brand) and secondary (outlined); sizes `md` and `sm`; default, hover and disabled |
| `IconButton` | neutral and danger; default, hover and disabled |
| `TextLink` | default, underlined on hover — named to avoid colliding with React Router's `Link`, which it wraps |
| `Tag` | pill, in any of the seven color families, plus a neutral fallback for an uncategorized transaction |
| `CategoryBadge` | rounded icon tile in a category's color, with a neutral fallback |
| `TypeIndicator` | "Entrada" with an up arrow in success green; "Saída" with a down arrow in danger red |
| `Pagination` | numbered buttons with default, hover, active and disabled states, plus previous and next |
| `Dialog` | centered card with title, subtitle, close button and scrim |
| `Card` | white surface with rounded corners, used by every panel |
| `StatCard` | icon, uppercase label, large value |
| `Avatar` | circle with initials derived from the user's name |

The label error state colors the label itself, not only the helper text — that
is how the Style Guide draws it, and it makes the failing field findable without
reading every helper line.

## 4. Layout

Signed-in pages share one shell: a white top bar with the Financy logo on the
left, "Dashboard / Transações / Categorias" centered with the active item in
brand green, and an avatar on the right that links to `/profile`. The content
area sits on `gray-100`.

Public pages (login, sign up) have no top bar: a centered card on `gray-100`
with the logo above it.

The design is specified at desktop width. The layout uses responsive grids that
collapse to a single column on narrow screens, and the top bar collapses to a
menu below the medium breakpoint. This is not in the Figma file; it is the
minimum needed for the app not to break on a laptop at a smaller window size.

## 5. Screens

### Login (`/`, signed out)

Card titled "Fazer login" with the subtitle "Entre na sua conta para continuar".
Email, password with visibility toggle, a "Lembrar-me" checkbox, an "ou"
divider, and a secondary "Criar conta" button linking to `/signup`.

On success, store the token and land on the dashboard. On failure the API
returns `INVALID_CREDENTIALS`, rendered as a form-level error — never as "this
email does not exist", which would leak which addresses have accounts.

"Recuperar senha" is not rendered. See section 12.

### Sign up (`/signup`)

Card titled "Criar conta", subtitle "Comece a controlar suas finanças ainda
hoje". Full name, email, password with the helper "A senha deve ter no mínimo 8
caracteres" shown before the user types, not only on error. Secondary "Fazer
login" button.

On success the user is signed in immediately with the returned token.
`EMAIL_ALREADY_EXISTS` renders on the email field.

### Dashboard (`/`, signed in)

Three stat cards across the top: Saldo total, Receitas do mês, Despesas do mês —
from `summary(month, year)` for the current month.

Below, two panels side by side:

- **Transações recentes** — the five most recent transactions, each with its
  category icon badge, description, date, category tag, and signed amount with a
  type arrow. A "Ver todas" link to `/transactions` and a "+ Nova transação"
  footer button that opens the transaction dialog.
- **Categorias** — each category with its tag, item count and total amount, plus
  a "Gerenciar" link to `/categories`. Sorted by total amount descending, capped
  at five, because the panel is a summary and the full list has its own page.

### Transactions (`/transactions`)

Title, subtitle, and a "+ Nova transação" button.

A filter bar with four controls: a description search, a type select
(Todos / Entrada / Saída), a category select (Todas, plus the user's
categories), and a month/year period select. The period select offers the
current month and the eleven before it. Changing any filter resets to page 1 —
staying on page 3 of a different result set shows an empty table for no visible
reason.

Search is debounced at 300ms so typing does not fire a request per keystroke.
All filter state lives in the URL query string, so a filtered view can be
reloaded, bookmarked and shared, and the back button behaves.

The table has columns Descrição (with the category icon badge), Data, Categoria,
Tipo, Valor and Ações. Ações holds a danger delete `IconButton` and a neutral
edit `IconButton`. The footer shows "1 a 10 | 27 resultados" and pagination.

Ten rows per page, matching the design.

### Categories (`/categories`)

Title, subtitle, and a "+ Nova categoria" button. Three stat cards from
`categoryStats`: Total de categorias, Total de transações, Categoria mais
utilizada. A responsive grid of category cards, four per row at desktop width.

Each card shows the icon badge, delete and edit icon buttons, the name, the
description, the tag and the item count.

### Profile (`/profile`)

Centered card: large avatar, name, email. A "Nome completo" input, an email
input rendered disabled with the helper "O e-mail não pode ser alterado", a
"Salvar alterações" primary button and a "Sair da conta" secondary button with a
danger-colored icon.

Signing out clears the stored token and the entire query cache, then redirects
to `/`. Clearing the cache matters: without it, the next user to sign in on the
same browser briefly sees the previous user's data rendered from cache.

### Transaction dialog

Title "Nova transação" or "Editar transação", subtitle "Registre sua despesa ou
receita". A two-option segmented control for Despesa and Receita, where the
selected side takes the danger or success color. Then description, a date field
and a currency field side by side, and a category select.

The amount field displays as `R$ 0,00` and converts to integer cents on submit.
The user types decimal currency; the API only ever receives cents. This
conversion happens in one place, next to the equivalent parsing for display, so
the two cannot drift apart.

### Category dialog

Title "Nova categoria" or "Editar categoria", subtitle "Organize suas transações
com categorias". Title, an optional description labelled "Opcional", a grid of
sixteen selectable icons, and a row of seven color swatches. The selected icon
and color are outlined in brand green.

## 6. Data layer

`graphql-codegen` reads the backend's schema and the `.graphql` operation
documents in the app, and generates typed hooks. Generated files are committed,
so a fresh clone builds without running the backend first.

Query keys follow the operation and its variables, and invalidation is explicit:

| Mutation | Invalidates |
|---|---|
| `createTransaction`, `updateTransaction`, `deleteTransaction` | transactions, summary, categories, categoryStats |
| `createCategory`, `updateCategory` | categories, categoryStats |
| `deleteCategory` | categories, categoryStats, transactions |
| `updateProfile` | me |

Deleting a category invalidates transactions because the backend unlinks them —
their rows must re-render without the category rather than showing a tag for
something that no longer exists.

Transaction mutations invalidate the category lists because both carry per
category counts and totals, which are now stale.

A single GraphQL client attaches the bearer token to every request. When the API
answers `UNAUTHENTICATED`, the client clears the stored token and the cache and
redirects to the login page — an expired token should return the user to login,
not to a screen of failed panels.

## 7. Authentication

The token is kept in a React context alongside the current user, hydrated from
storage on load. Private routes render through a guard that redirects to `/`
when there is no token; public routes redirect to the dashboard when there is
one.

**Storage.** "Lembrar-me" checked stores the token in `localStorage`, so it
survives closing the browser. Unchecked uses `sessionStorage`, so it dies with
the tab. The checkbox controls something real rather than decorating the form.

**The trade-off, stated plainly.** The API returns the JWT in the response body,
so an `httpOnly` cookie is not possible without changing the backend. That means
the token is readable by any JavaScript running on the page, and an XSS flaw
becomes session theft. What is in scope to reduce that risk: never render
user-supplied HTML — React escapes by default and `dangerouslySetInnerHTML` is
not used anywhere in this app — and keep dependencies current. A future move to
`httpOnly` cookies with `SameSite=Strict` would remove the exposure, and would
require a change to `backend.md`.

## 8. Forms and validation

React Hook Form with zod resolvers. Validation schemas mirror the backend rules
in `backend.md`, section 7 — same minimum password length, same maximum
description lengths, same required fields.

Client validation is for feedback speed, not for safety. The server validates
independently and is the only thing that decides what is stored. Any server
field error maps back onto its field; anything else renders at form level.

Submit buttons disable while a mutation is in flight, so a double click cannot
create two transactions.

## 9. Formatting

Amounts arrive as integer cents and render as Brazilian currency through
`Intl.NumberFormat('pt-BR')`. Expenses render with a leading `-` and income with
a leading `+`, matching the design.

Dates arrive as ISO strings and render as `DD/MM/YY` in lists, as the design
shows. The date input submits a date at local midnight.

The interface language is Brazilian Portuguese throughout, following the design.
Strings are inline rather than in a translation layer — there is one language,
and an i18n setup for one language is machinery without a purpose.

## 10. Screen states

Every list and panel handles four states explicitly. Skipping these is the most
common way a correct-looking application feels broken.

- **Loading** — skeletons shaped like the content they replace, not a spinner
  over the whole page.
- **Empty** — a message and the action that fixes it: "Nenhuma transação ainda"
  with a create button. The filtered-empty case says something different, that
  no result matched the filters, and offers to clear them. A user who filters
  into nothing should not be told they have no transactions.
- **Error** — a message with a retry, scoped to the panel that failed.
- **Populated** — the design as drawn.

Destructive actions confirm first. Deleting a transaction or a category opens a
confirmation dialog naming what is about to be deleted, and the category one
states that its transactions will be kept without a category — the consequence
is not obvious from the button.

Mutation results surface as toasts: brief confirmation on success, the API
message on failure.

## 11. Structure

```
apps/frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/              design system primitives
│   │   └── layout/          top bar, page shell, guards
│   ├── features/
│   │   ├── auth/            login, sign up, session context
│   │   ├── dashboard/
│   │   ├── transactions/    page, table, filters, dialog
│   │   ├── categories/      page, grid, dialog
│   │   └── profile/
│   ├── graphql/
│   │   ├── operations/      .graphql documents
│   │   └── generated/       codegen output, committed
│   ├── lib/                 client, formatters, category tokens
│   ├── routes.tsx
│   └── main.tsx
├── .env.example
├── codegen.ts
├── tailwind.config.ts
└── vite.config.ts
```

Organized by feature, not by file type, matching the backend. A feature folder
holds its page, its components, its hooks and its validation together, so
changing one screen means opening one directory.

`components/ui` is the only place that may define visual primitives. A page that
needs a new button variant extends the primitive rather than styling a `div`,
otherwise the design system stops being the source of truth within a week.

## 12. Deviations from the design

Recorded rather than silently applied.

**"Recuperar senha" is not rendered.** Password recovery is deferred to phase 2
(`backend.md`, section 11). The alternative — showing the link disabled — was
rejected: a user locked out of their account is exactly who clicks it, and a
dead link tells them a way out exists when it does not.

**Uncategorized transactions.** The design has no state for a transaction with
no category, but the API allows it, both at creation and after its category is
deleted. Those rows render a neutral gray "Sem categoria" tag and a gray icon
badge, using the existing tag component.

**Category tag on the dashboard.** The design's "Transações recentes" panel
shows a category tag on some rows and a type tag ("Receita") on one. This spec
uses the category tag consistently, since the type is already conveyed by the
colored arrow and the sign on the amount.

**`Select` has no checkmark on the selected option.** Section 3 describes one,
which a native `<select>` cannot draw — the browser owns the dropdown. The
alternative is a custom listbox, which means rebuilding keyboard navigation,
typeahead, screen reader semantics and the mobile picker, all to add a tick to a
list that already shows its selection in the closed control. The native element
is kept; the checkmark is not.

**Responsive behavior** is defined here, not in the design, which is
desktop-only. See section 4.

## 13. Environment

```
VITE_BACKEND_URL=http://localhost:4000/graphql
```

Validated at startup with zod. A missing backend URL fails immediately with a
clear message rather than producing failed requests to `undefined`.

Any variable added later must be added to `.env.example` in the same change.
Only `VITE_`-prefixed variables reach the client — and everything that reaches
the client is public, so no secret belongs in this file.

## 14. Testing

Vitest with React Testing Library, testing behavior through the interface rather
than implementation details. The GraphQL layer is mocked with MSW, so tests
exercise the real client and the real query cache.

Coverage expectations:

- Sign in and sign up, including error rendering for bad credentials and a
  duplicate email.
- Route guards: a private route redirects when signed out, a public route
  redirects when signed in.
- Creating, editing and deleting a transaction and a category, each confirming
  the affected lists refetch.
- Filters and pagination on the transactions page, including that changing a
  filter resets to page 1 and that filter state round-trips through the URL.
- Currency conversion in both directions: typed decimal to cents, cents to
  display. This is where a silent off-by-one-hundred lives.
- Empty, loading and error states for each list.
- Sign out clears the cache.

## 15. Open items

None. Every decision needed to write the implementation plan is recorded above.

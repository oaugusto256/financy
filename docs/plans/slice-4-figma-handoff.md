# Slice 4 — Figma handoff checklist

The agent building this slice has no Figma access. Every item below is for the
repository owner. Run `npm run dev` and compare against the Figma tabs named in
each section. Report differences; they are corrected before the pull request is
opened.

## Blocking

Nothing here is blocking. This slice builds on nothing unanswered.

## What is now built and ready to compare

### The filter bar (`/transactions`)

- [ ] Its placement — a row of four controls sitting above the table, below
      the page title and the "+ Nova transação" button.
- [ ] The four controls and their labels: "Buscar" (a search input with a
      leading icon, placeholder "Descrição"), "Tipo" (a select: Todos /
      Entrada / Saída), "Categoria" (a select: Todas, plus the user's
      categories), "Período" (a select of month options).
- [ ] The responsive layout — two controls per row below the `sm` breakpoint,
      four across it.
- [ ] The period option labels — "Agosto de 2026", not "agosto de 2026" or
      "08/2026" — and that "Todos os períodos" is the first option, above the
      current month.

### The filtered-empty state

- [ ] Its copy: "Nenhuma transação encontrada" / "Nenhum resultado
      corresponde aos filtros aplicados.", distinct from the unfiltered empty
      state's "Nenhuma transação ainda".
- [ ] The "Limpar filtros" button — a secondary button, in place of the
      unfiltered state's primary "Criar primeira transação".

### The `/style-guide` primitive comparison

- [ ] Still unanswered. It has now been open for four slices.

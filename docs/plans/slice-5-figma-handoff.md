# Slice 5 — Figma handoff checklist

The agent building this slice has no Figma access. Every item below is for the
repository owner. Run `npm run dev` and compare against the Figma tabs named in
each section. Report differences; they are corrected before the pull request is
opened.

Nothing here gates this slice — it is built and ready for the owner to compare,
same as every prior slice's handoff.

## New this slice — compare after the dashboard is built

### Dashboard (`/`)

- [ ] The page subtitle "Sua visão geral do mês", which the design does not
      name — confirm the wording, or give the correct one.
- [ ] The three stat cards: labels ("Saldo total", "Receitas do mês",
      "Despesas do mês"), the chosen icons (`Wallet`, `ArrowUpCircle`,
      `ArrowDownCircle`) and the icon tints (neutral for Saldo total,
      `text-success` for Receitas do mês, `text-danger` for Despesas do mês).
- [ ] The two-panel row's layout: side by side from the `lg` breakpoint,
      stacked below it. Confirm the breakpoint against the design's own
      responsive behavior, which is desktop-only (`frontend.md` section 4).

### "Transações recentes" panel

- [ ] Row composition: category icon badge, then description over date, then
      the category tag, then the signed amount over the type indicator arrow.
- [ ] The "Ver todas" link to `/transactions` and the "+ Nova transação"
      footer button — both present in every state (loading, empty, error,
      populated), not only the populated one.
- [ ] **The panel error state renders `PanelError` inside the panel body**, so
      its card border sits inside the panel's own card — an inset error box
      that keeps the panel heading and its "Ver todas" link on screen rather
      than replacing the whole panel. Confirm this nesting reads correctly,
      rather than the whole card being replaced by the error.

### "Categorias" panel

- [ ] Row composition: category badge, then name over item count, then the
      tag repeating the category name, then the total amount. The tag
      repeating the name follows the category card's existing treatment,
      itself still unconfirmed since slice 2 (see
      `slice-2-figma-handoff.md`) — this is the same open question appearing
      a second time, not a new one.
- [ ] The "Gerenciar" link to `/categories`, present in every state.

## Carried forward, not new to this slice

### The `/style-guide` primitive comparison (Style Guide tab)

- [ ] Every primitive at `http://localhost:5173/style-guide`, in every state,
      against the Style Guide frames. Unanswered across five slices; it has
      never gated any of them. No new primitive was added by this slice, so
      nothing new is owed here — carried forward unchanged.

### The category card's tag (Categories page, category dialog)

- [ ] Still open from `slice-2-figma-handoff.md`: whether the category tag
      repeating the card's own name is the right reading of the design. This
      slice's "Categorias" panel repeats the same treatment on the dashboard,
      so a correction there would apply in both places.

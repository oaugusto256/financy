# Slice 2 — Figma handoff checklist

The agent building this slice has no Figma access. Every item below is for the
repository owner. Run `npm run dev` and compare against the Figma tabs named in
each section. Report differences; they are corrected before the pull request is
opened.

## Blocking — answer before the icon and color pickers are built

These two are carried forward from slice 0 and were already recorded as
blocking in `slice-1-outcome.md`.

### The sixteen `CategoryIcon` names (Style Guide tab)

`apps/frontend/src/lib/category-tokens.ts` maps each token to a Lucide
component. Confirm each row, or give the correct icon:

| Token | Lucide component | Proposed Portuguese label (accessible name) |
|---|---|---|
| `BRIEFCASE` | `Briefcase` | Maleta |
| `BUS` | `Bus` | Ônibus |
| `HEART_PULSE` | `HeartPulse` | Saúde |
| `PIGGY_BANK` | `PiggyBank` | Cofrinho |
| `SHOPPING_CART` | `ShoppingCart` | Carrinho de compras |
| `TICKET` | `Ticket` | Ingresso |
| `GIFT` | `Gift` | Presente |
| `UTENSILS` | `Utensils` | Restaurante |
| `BIKE` | `Bike` | Bicicleta |
| `HOME` | `House` | Casa |
| `HAND_COINS` | `HandCoins` | Moedas |
| `BOOK_OPEN` | `BookOpen` | Livro |
| `STORE` | `Store` | Loja |
| `WALLET` | `Wallet` | Carteira |
| `CREDIT_CARD` | `CreditCard` | Cartão de crédito |
| `RECEIPT` | `Receipt` | Recibo |

`HOME` maps to Lucide's `House` because `Home` was renamed in `lucide-react` 1.
The token name is the API contract and does not change.

The Portuguese labels are not in the design — they are the accessible names for
the picker's radio buttons, which a screen reader announces. They need to be
right, not necessarily to match anything visual.

- [ ] The sixteen icons are the ones the Style Guide draws.
- [ ] The labels read naturally in Brazilian Portuguese.

### The `/style-guide` primitive comparison (Style Guide tab)

- [ ] Every primitive at `http://localhost:5173/style-guide`, in every state,
      against the Style Guide frames. This is the check slice 0 deferred.

## New this slice — compare after the screens are built

### Categories page (`/categories`)

- [ ] The three stat cards: order, icons, uppercase labels, value size.
- [ ] Grid density — four cards per row at desktop width.
- [ ] **What the tag on a card carries.** The spec sentence lists "the tag and
      the item count" while the card already shows the name. It is built as the
      category name in the category color, with the count beside it as
      "N itens". Confirm or correct.
- [ ] Card internals: badge size, position of the edit and delete buttons,
      description truncation when it is long.
- [ ] Empty state copy and its create button.
- [ ] The loading skeleton's shape against the populated grid.

### Category dialog

- [ ] Icon grid: columns, cell size, gap.
- [ ] **Icon preview color.** The icons in the picker render neutral gray, not
      in the currently selected color. Confirm or correct.
- [ ] **Default selection.** A new category opens with `WALLET` and `GREEN`
      preselected, because the design gives both pickers a default. Confirm the
      two defaults.
- [ ] Swatch row: size, gap, the selected outline in brand green.
- [ ] The "Opcional" treatment on the description label.

### Delete confirmation

- [ ] Copy: it names the category and states that its transactions are kept
      without a category. The design has no frame for this dialog; the wording
      is ours.

### Toast

- [ ] Position, width, colors for success and failure, and how long it stays.
      The design specifies toasts (`frontend.md` section 10) without drawing
      one at a size we could measure.

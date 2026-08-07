import { z } from 'zod';

/**
 * The closed sets from `backend.md` section 5. SQLite cannot hold an enum, so
 * the set is enforced in the SDL, in TypeScript, and here — and this is the
 * only one of the three that runs before a write.
 */
export const CATEGORY_ICONS = [
  'BRIEFCASE',
  'BUS',
  'HEART_PULSE',
  'PIGGY_BANK',
  'SHOPPING_CART',
  'TICKET',
  'GIFT',
  'UTENSILS',
  'BIKE',
  'HOME',
  'HAND_COINS',
  'BOOK_OPEN',
  'STORE',
  'WALLET',
  'CREDIT_CARD',
  'RECEIPT',
] as const;

export const CATEGORY_COLORS = [
  'GREEN',
  'BLUE',
  'PURPLE',
  'PINK',
  'RED',
  'ORANGE',
  'YELLOW',
] as const;

export type CategoryIconToken = (typeof CATEGORY_ICONS)[number];
export type CategoryColorToken = (typeof CATEGORY_COLORS)[number];

const name = z
  .string()
  .trim()
  .min(1, 'O nome é obrigatório')
  .max(50, 'O nome deve ter no máximo 50 caracteres');

// zod 4 takes the message as `{ error }`; `required_error` is silently ignored.
const icon = z.enum(CATEGORY_ICONS, { error: 'Selecione um ícone válido' });
const color = z.enum(CATEGORY_COLORS, { error: 'Selecione uma cor válida' });

const description = z
  .string()
  .trim()
  .max(200, 'A descrição deve ter no máximo 200 caracteres')
  .nullish()
  // An empty string is a cleared field, not a description of "". Undefined is
  // left undefined here so update can tell "absent" from "cleared"; create
  // collapses it to null itself. Explicit null (also a "cleared" signal) must
  // be handled before reading `.length`, or it throws.
  .transform((value) =>
    value === undefined
      ? undefined
      : value === null || value.length === 0
        ? null
        : value,
  );

export const createCategorySchema = z
  .object({ name, description, icon, color })
  .transform((input) => ({ ...input, description: input.description ?? null }));

export const updateCategorySchema = z.object({
  name: name.optional(),
  description,
  icon: icon.optional(),
  color: color.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

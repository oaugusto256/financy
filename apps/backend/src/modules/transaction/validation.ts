import { z } from 'zod';

/**
 * The closed set from `backend.md` section 5. SQLite cannot hold an enum, so it
 * is enforced in the SDL, in TypeScript, and here — and this is the only one of
 * the three that runs before a write.
 */
export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;

export type TransactionTypeToken = (typeof TRANSACTION_TYPES)[number];

/** Matches the transactions table in the design: "1 a 10 | 27 resultados". */
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

const description = z
  .string()
  .trim()
  .min(1, 'A descrição é obrigatória')
  .max(200, 'A descrição deve ter no máximo 200 caracteres');

const amount = z
  .int({ error: 'O valor deve ser um número inteiro de centavos' })
  // The sign is not used; `type` carries the direction. Zero is the only amount
  // with no meaning.
  .refine((value) => value !== 0, 'O valor não pode ser zero');

// zod 4 takes the message as `{ error }`; `required_error` is silently ignored.
const type = z.enum(TRANSACTION_TYPES, { error: 'Selecione um tipo válido' });

// coerce, not z.date(): the resolver hands over whatever the DateTime scalar
// produced, and the service is also called directly from tests with a string.
const date = z.coerce.date({ error: 'Informe uma data válida' });

const categoryId = z
  .string()
  .trim()
  .nullish()
  // Undefined is left undefined so update can tell "absent" from "cleared";
  // create collapses it to null itself. An empty string arrives from a cleared
  // <select> and means the same as null. No `.min(1)` — it would reject the
  // empty string before this transform ever sees it.
  .transform((value) =>
    value === undefined
      ? undefined
      : value === null || value.length === 0
        ? null
        : value,
  );

export const createTransactionSchema = z
  .object({ description, amount, type, date, categoryId })
  .transform((input) => ({ ...input, categoryId: input.categoryId ?? null }));

export const updateTransactionSchema = z.object({
  description: description.optional(),
  amount: amount.optional(),
  type: type.optional(),
  date: date.optional(),
  categoryId,
});

export const transactionPageSchema = z
  .object({
    limit: z
      .int({ error: 'O limite deve ser um número inteiro' })
      .min(1, 'O limite deve ser pelo menos 1')
      .nullish(),
    offset: z
      .int({ error: 'O deslocamento deve ser um número inteiro' })
      .min(0, 'O deslocamento não pode ser negativo')
      .nullish(),
  })
  // Below the minimum rejects, above the maximum clamps. backend.md section 5
  // says the maximum holds "regardless of what the client sends", so a request
  // for 500 rows is answered with 100 rather than an error; a request for zero
  // rows is a mistake worth naming.
  .transform(({ limit, offset }) => ({
    limit: Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    offset: offset ?? 0,
  }));

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionPageArgs = z.infer<typeof transactionPageSchema>;

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
  .string({ error: 'A descrição é obrigatória' })
  .trim()
  .min(1, 'A descrição é obrigatória')
  .max(200, 'A descrição deve ter no máximo 200 caracteres');

// The sign is not used; `type` carries the direction — but a negative value
// still corrupts Category.totalAmount (an unsigned sum, backend.md section 5)
// and totalBalance (a signed sum by `type`), so it is rejected outright.
// `.positive()` also excludes zero, the one amount with no meaning.
const amount = z
  .int({ error: 'O valor deve ser um número inteiro de centavos' })
  .positive('O valor deve ser maior que zero');

// zod 4 takes the message as `{ error }`; `required_error` is silently ignored.
const type = z.enum(TRANSACTION_TYPES, { error: 'Selecione um tipo válido' });

// Coercion still runs, since the resolver hands over whatever the DateTime
// scalar produced and the service is also called directly from tests with a
// string — but bare z.coerce.date() also accepts `null`, because
// `new Date(null)` is the valid Date 1970-01-01. A `date: null` update input
// (well-formed GraphQL: the field is nullable in the SDL) would otherwise
// reach the service and silently overwrite the row with the epoch. Requiring
// a string or a Date first, then coercing, rejects null and anything else
// that is not already date-shaped.
const date = z
  .union([z.string(), z.date()], { error: 'Informe uma data válida' })
  .pipe(z.coerce.date({ error: 'Informe uma data válida' }));

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

// A filter's absent, null and empty-string forms all mean the same thing:
// no filter on that field. That is not true of the create/update inputs,
// where an empty categoryId means "clear the category" — hence a separate
// set of field schemas rather than reusing the ones above.
const searchTerm = z
  .string({ error: 'A busca deve ser um texto' })
  .trim()
  .max(100, 'A busca deve ter no máximo 100 caracteres')
  .nullish()
  .transform((value) => value || undefined);

const filterCategoryId = z
  .string({ error: 'A categoria deve ser um texto' })
  .trim()
  .nullish()
  .transform((value) => value || undefined);

// Same union+pipe as the `date` field above, but followed by `.nullish()`
// instead of leaving the field required: a filter's dateFrom/dateTo really
// can be null. `.nullish()` is what turns that null (and undefined) into
// undefined before the pipe ever runs, heading off bare z.coerce.date()
// reading null as 1970-01-01 — here the consequence is worse than a wrong
// stored value, since a null dateTo would silently return nothing. The union
// above it still does its own job: guarding a non-date-shaped value like
// `42` from being silently coerced.
const dateBound = z
  .union([z.string(), z.date()], { error: 'Informe uma data válida' })
  .pipe(z.coerce.date({ error: 'Informe uma data válida' }))
  .nullish()
  .transform((value) => value ?? undefined);

export const transactionFilterSchema = z.object({
  search: searchTerm,
  type: type.nullish().transform((value) => value ?? undefined),
  categoryId: filterCategoryId,
  dateFrom: dateBound,
  dateTo: dateBound,
});

export const transactionPageSchema = z
  .object({
    filter: transactionFilterSchema.nullish(),
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
  .transform(({ filter, limit, offset }) => ({
    // An empty object, never undefined: the service destructures this. Every
    // field of TransactionFilterArgs is a required key with an `| undefined`
    // value (zod does not mark a transformed field optional key-wise), so an
    // untyped {} is missing keys structurally even though reading any of them
    // off a real {} at runtime yields undefined either way — hence the cast.
    filter: filter ?? ({} as TransactionFilterArgs),
    limit: Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    offset: offset ?? 0,
  }));

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilterArgs = z.infer<typeof transactionFilterSchema>;
export type TransactionPageArgs = z.infer<typeof transactionPageSchema>;

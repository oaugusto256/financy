import { z } from 'zod';

/**
 * The epoch and the largest year `Date.UTC` round-trips through a four-digit
 * DateTime. Both bounds exist to stop a nonsense year reaching a groupBy that
 * would scan, return zeros, and read as "no data" rather than as the input
 * error it is. backend.md section 5.
 */
export const MIN_YEAR = 1970;
export const MAX_YEAR = 9999;

// zod 4 takes the message as `{ error }`; `required_error` is silently ignored.
const month = z
  .int({ error: 'O mês deve ser um número inteiro' })
  .min(1, 'O mês deve estar entre 1 e 12')
  .max(12, 'O mês deve estar entre 1 e 12');

const year = z
  .int({ error: 'O ano deve ser um número inteiro' })
  .min(MIN_YEAR, 'O ano deve estar entre 1970 e 9999')
  .max(MAX_YEAR, 'O ano deve estar entre 1970 e 9999');

export const summaryArgsSchema = z.object({ month, year });

export type SummaryArgs = z.infer<typeof summaryArgsSchema>;

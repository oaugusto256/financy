import { z } from 'zod';

/**
 * Mirrors `backend.md` section 7. Client validation is for feedback speed; the
 * server validates independently and is the only thing that decides what is
 * stored. Keeping the numbers identical is what stops the two from disagreeing
 * about the same input.
 */
export const transactionFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Informe uma descrição')
    .max(200, 'A descrição deve ter no máximo 200 caracteres'),
  // Already an integer number of cents — the field is masked, so there is no
  // decimal string to parse here or anywhere else.
  amount: z
    .int()
    .refine((value) => value !== 0, 'Informe um valor maior que zero'),
  type: z.enum(['EXPENSE', 'INCOME'], { error: 'Selecione um tipo' }),
  // The yyyy-MM-dd an <input type="date"> holds, converted on submit.
  date: z.string().min(1, 'Informe uma data'),
  // An empty string is "sem categoria", which the API takes as null.
  categoryId: z.string(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

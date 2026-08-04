import { z } from 'zod';
import {
  CATEGORY_COLOR_VALUES,
  CATEGORY_ICON_VALUES,
} from '@/lib/category-tokens';

/**
 * Mirrors `backend.md` section 7. Client validation is for feedback speed; the
 * server validates independently and is the only thing that decides what is
 * stored. Keeping the numbers identical is what stops the two from disagreeing
 * about the same input.
 */
export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe um nome')
    .max(50, 'O nome deve ter no máximo 50 caracteres'),
  description: z
    .string()
    .trim()
    .max(200, 'A descrição deve ter no máximo 200 caracteres'),
  icon: z.enum(CATEGORY_ICON_VALUES, { error: 'Selecione um ícone' }),
  color: z.enum(CATEGORY_COLOR_VALUES, { error: 'Selecione uma cor' }),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

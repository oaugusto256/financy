import { z } from 'zod';
import { badUserInput } from './errors.js';

/**
 * Parses at a service boundary, turning a zod failure into the BAD_USER_INPUT
 * error the frontend knows how to render, with the failing fields named.
 *
 * Lives in shared/ rather than in a module: it knows nothing about any domain,
 * and every module needs it. It started in modules/auth/ only because auth was
 * the first module written.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const { fieldErrors } = z.flattenError(result.error);
  const firstMessage = result.error.issues[0]?.message ?? 'Dados inválidos';

  throw badUserInput(firstMessage, fieldErrors as Record<string, string[]>);
}

import { z } from 'zod';

// z.url(), not z.string({ required_error }).url(). zod 4 removed the v3
// spelling and ignores required_error silently rather than erroring, so a
// message written that way never reaches anyone.
const envSchema = z.object({
  VITE_BACKEND_URL: z.url('VITE_BACKEND_URL must be a valid URL'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

export const env = parseEnv(import.meta.env);

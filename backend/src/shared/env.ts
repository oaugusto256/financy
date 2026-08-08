import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  // Required, with no default. It used to default to 'development', which made
  // the most permissive posture — introspection served, stack traces in every
  // error — the one a deploy got for forgetting a variable. Failing at startup
  // is the safer way to be wrong.
  NODE_ENV: z.enum(['development', 'test', 'production'], {
    error: 'NODE_ENV must be development, test or production',
  }),
  // Rate limiting. The defaults are the deployed posture, not a placeholder:
  // 300 requests a minute is well above what one person browsing the app
  // produces, and ten sign-in attempts per address per fifteen minutes is well
  // above what one person forgetting their password produces.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(900_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

// Parsed at module load, so a misconfigured server dies at startup with a
// readable message instead of failing on the first request that needs the
// missing value.
export const env = parseEnv(process.env);

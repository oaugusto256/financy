import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1, 'O nome é obrigatório')
  .max(100, 'O nome deve ter no máximo 100 caracteres');

const email = z
  .email('Informe um e-mail válido')
  .transform((value) => value.toLowerCase());

const password = z.string().min(8, 'A senha deve ter no mínimo 8 caracteres');

export const signUpSchema = z.object({ name, email, password });

export const signInSchema = z.object({
  email,
  // Deliberately unconstrained: sign-in checks the stored hash, not today's
  // password policy.
  password: z.string(),
});

export const updateProfileSchema = z.object({ name });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

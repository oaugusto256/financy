import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  // No minimum length. It mirrors the backend, which does not apply today's
  // policy to an existing account, and telling someone their password is too
  // short before checking it is feedback about the wrong thing.
  password: z.string().min(1, 'Informe sua senha'),
  remember: z.boolean(),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe seu nome')
    .max(100, 'O nome deve ter no máximo 100 caracteres'),
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

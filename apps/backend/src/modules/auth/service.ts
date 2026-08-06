import type { User } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { hashPassword, verifyPassword } from '../../shared/password.js';
import { signToken } from '../../shared/jwt.js';
import {
  emailAlreadyExists,
  invalidCredentials,
  notFound,
} from '../../shared/errors.js';
import { parseInput } from '../../shared/validation.js';
import {
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from './validation.js';

export interface AuthResult {
  token: string;
  user: User;
}

export async function signUp(input: unknown): Promise<AuthResult> {
  const { name, email, password } = parseInput(signUpSchema, input);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw emailAlreadyExists();

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });

  return { token: await signToken(user.id), user };
}

export async function signIn(input: unknown): Promise<AuthResult> {
  const { email, password } = parseInput(signInSchema, input);

  const user = await prisma.user.findUnique({ where: { email } });
  // The unknown-email branch still verifies nothing and returns the same error
  // as a wrong password. Distinguishing them turns this into a way to discover
  // which addresses have accounts.
  if (!user) throw invalidCredentials();

  const matches = await verifyPassword(user.passwordHash, password);
  if (!matches) throw invalidCredentials();

  return { token: await signToken(user.id), user };
}

export async function getUser(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Usuário');
  return user;
}

export async function updateProfile(
  userId: string,
  input: unknown,
): Promise<User> {
  const { name } = parseInput(updateProfileSchema, input);

  // updateMany scoped by id rather than update, matching the ownership rule in
  // backend.md section 6: the filter is in the where clause, and the affected
  // count is what says whether the row existed.
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { name },
  });
  if (count === 0) throw notFound('Usuário');

  return getUser(userId);
}

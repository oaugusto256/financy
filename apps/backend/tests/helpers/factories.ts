import { prisma } from '../../src/shared/prisma.js';
import { hashPassword } from '../../src/shared/password.js';
import { VALID_PASSWORD } from './credentials.js';

let sequence = 0;

/** Creates a user directly, bypassing the service under test. */
export async function createUser(
  overrides: { name?: string; email?: string; password?: string } = {},
) {
  sequence += 1;
  const password = overrides.password ?? VALID_PASSWORD;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Usuário ${sequence}`,
      email: overrides.email ?? `usuario${sequence}@exemplo.com`,
      passwordHash: await hashPassword(password),
    },
  });

  return { user, password };
}

/** Creates a category directly, bypassing the service under test. */
export async function createCategory(
  userId: string,
  overrides: {
    name?: string;
    description?: string | null;
    icon?: string;
    color?: string;
  } = {},
) {
  sequence += 1;

  return prisma.category.create({
    data: {
      userId,
      name: overrides.name ?? `Categoria ${sequence}`,
      description: overrides.description ?? null,
      icon: overrides.icon ?? 'WALLET',
      color: overrides.color ?? 'GREEN',
    },
  });
}

/**
 * Creates a transaction directly. Slice 2 has no transaction API; these rows
 * exist so category aggregates and the unlink-on-delete rule are testable
 * where they are implemented rather than a slice later.
 */
export async function createTransaction(
  userId: string,
  overrides: {
    categoryId?: string | null;
    description?: string;
    amount?: number;
    type?: 'INCOME' | 'EXPENSE';
    date?: Date;
  } = {},
) {
  sequence += 1;

  return prisma.transaction.create({
    data: {
      userId,
      categoryId: overrides.categoryId ?? null,
      description: overrides.description ?? `Transação ${sequence}`,
      amount: overrides.amount ?? 1000,
      type: overrides.type ?? 'EXPENSE',
      // Derived from `sequence`, not a shared constant: a fixed date meant
      // every row landed in the same bucket by default, so a test that
      // forgot to override `date` for a date-range case could pass by
      // coincidence. Still deterministic (no Date.now(), no randomness) —
      // that determinism is the reason a constant was here in the first
      // place.
      date: overrides.date ?? new Date(Date.UTC(2026, 7, sequence, 12, 0, 0)),
    },
  });
}

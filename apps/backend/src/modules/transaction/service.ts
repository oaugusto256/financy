import type { Transaction } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { notFound } from '../../shared/errors.js';
import { parseInput } from '../../shared/validation.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from './validation.js';

/**
 * A supplied categoryId has to belong to the same user, or a person could
 * attach their transaction to someone else's category and learn it exists.
 * NOT_FOUND, never FORBIDDEN — FORBIDDEN confirms the id is real, which is the
 * thing being hidden. backend.md section 6.
 */
async function assertCategoryOwned(
  userId: string,
  categoryId: string,
): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  if (!category) throw notFound('Categoria');
}

export async function getTransaction(
  userId: string,
  id: string,
): Promise<Transaction> {
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId },
  });
  if (!transaction) throw notFound('Transação');
  return transaction;
}

export async function createTransaction(
  userId: string,
  input: unknown,
): Promise<Transaction> {
  const data = parseInput(createTransactionSchema, input);
  if (data.categoryId) await assertCategoryOwned(userId, data.categoryId);

  return prisma.transaction.create({
    data: {
      userId,
      description: data.description,
      amount: data.amount,
      type: data.type,
      date: data.date,
      categoryId: data.categoryId,
    },
  });
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: unknown,
): Promise<Transaction> {
  const data = parseInput(updateTransactionSchema, input);

  // Existence first. Checking the category first would answer NOT_FOUND naming
  // the category on a request whose real problem is the transaction id.
  await getTransaction(userId, id);
  if (data.categoryId) await assertCategoryOwned(userId, data.categoryId);

  const { count } = await prisma.transaction.updateMany({
    where: { id, userId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.date !== undefined && { date: data.date }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    },
  });
  if (count === 0) throw notFound('Transação');

  return getTransaction(userId, id);
}

export async function deleteTransaction(
  userId: string,
  id: string,
): Promise<boolean> {
  // deleteMany scoped by { id, userId }: there is no window between fetching
  // the row and checking who owns it. backend.md section 6.
  const { count } = await prisma.transaction.deleteMany({
    where: { id, userId },
  });
  if (count === 0) throw notFound('Transação');

  return true;
}

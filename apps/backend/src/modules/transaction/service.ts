import type { Prisma, Transaction } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { notFound } from '../../shared/errors.js';
import { parseInput } from '../../shared/validation.js';
import {
  createTransactionSchema,
  transactionPageSchema,
  updateTransactionSchema,
  type TransactionFilterArgs,
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

export interface TransactionPage {
  items: Transaction[];
  totalCount: number;
}

/**
 * The single source of the read's where clause. `userId` is not optional and
 * is not spread — it is the first key, unconditionally, so no future field can
 * be added in a way that forgets it. backend.md section 6.
 *
 * `contains` carries no `mode`: this client is generated for SQLite, which has
 * no QueryMode, and SQLite's LIKE is already case-insensitive for ASCII
 * (backend.md section 2). Note that `%` and `_` in a search term act as LIKE
 * wildcards — Prisma emits no ESCAPE clause, and §2 records the limit.
 */
function transactionWhere(
  userId: string,
  filter: TransactionFilterArgs,
): Prisma.TransactionWhereInput {
  const { search, type, categoryId, dateFrom, dateTo } = filter;

  return {
    userId,
    ...(search && { description: { contains: search } }),
    ...(type && { type }),
    ...(categoryId && { categoryId }),
    ...((dateFrom || dateTo) && {
      date: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  };
}

/**
 * Offset pagination, not cursors: the frontend needs "page 3" and, from slice 4,
 * date-range filtering — not infinite scroll. backend.md section 5.
 *
 * The tiebreaker on createdAt is load-bearing. Without it two transactions
 * sharing a date have no defined order, so the same row can appear on page 1
 * and page 2 of consecutive requests, or on neither.
 *
 * One `where` object, built once, handed to both queries. Two objects — even
 * two that look identical — is how a filter gets applied to the page and not
 * to the count, leaving a footer that promises rows the table cannot show.
 */
export async function listTransactions(
  userId: string,
  args: unknown,
): Promise<TransactionPage> {
  const { filter, limit, offset } = parseInput(transactionPageSchema, args);
  const where = transactionWhere(userId, filter);

  const [items, totalCount] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items, totalCount };
}

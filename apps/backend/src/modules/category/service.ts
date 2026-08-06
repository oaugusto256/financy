import type { Category } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { badUserInput, notFound } from '../../shared/errors.js';
import { parseInput } from '../../shared/validation.js';
import { createCategorySchema, updateCategorySchema } from './validation.js';

const DUPLICATE_NAME = 'Já existe uma categoria com esse nome';

function duplicateName() {
  // No dedicated error code: the frontend already renders fieldErrors on the
  // field they name. backend.md section 7 records this.
  return badUserInput(DUPLICATE_NAME, { name: [DUPLICATE_NAME] });
}

/**
 * assertNameAvailable checks and then writes, so a concurrent request with the
 * same name can slip between the two and hit @@unique([userId, name]). Without
 * this the caller gets INTERNAL_SERVER_ERROR for what backend.md section 7
 * promises is a BAD_USER_INPUT on the name field.
 */
function rethrowDuplicateName(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw duplicateName();
  }

  throw error;
}

async function assertNameAvailable(
  userId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const existing = await prisma.category.findFirst({
    where: { userId, name, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });

  if (existing) throw duplicateName();
}

export async function listCategories(userId: string): Promise<Category[]> {
  // Alphabetical: the grid has no other ordering in the design, and an
  // unordered list reshuffles itself on every refetch.
  return prisma.category.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
}

export async function getCategory(
  userId: string,
  id: string,
): Promise<Category> {
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) throw notFound('Categoria');
  return category;
}

export async function createCategory(
  userId: string,
  input: unknown,
): Promise<Category> {
  const data = parseInput(createCategorySchema, input);
  await assertNameAvailable(userId, data.name);

  return prisma.category
    .create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
      },
    })
    .catch(rethrowDuplicateName);
}

export async function updateCategory(
  userId: string,
  id: string,
  input: unknown,
): Promise<Category> {
  const data = parseInput(updateCategorySchema, input);

  // Existence first. Checking the name first would answer BAD_USER_INPUT for an
  // id the caller does not own, which is a different answer than NOT_FOUND for
  // the same request with an unused name.
  await getCategory(userId, id);
  if (data.name !== undefined) await assertNameAvailable(userId, data.name, id);

  const { count } = await prisma.category
    .updateMany({
      where: { id, userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.color !== undefined && { color: data.color }),
      },
    })
    .catch(rethrowDuplicateName);
  if (count === 0) throw notFound('Categoria');

  return getCategory(userId, id);
}

export async function deleteCategory(
  userId: string,
  id: string,
): Promise<boolean> {
  // deleteMany scoped by { id, userId }: there is no window between fetching
  // the row and checking who owns it. backend.md section 6.
  const { count } = await prisma.category.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound('Categoria');

  return true;
}

export interface CategoryStats {
  totalCategories: number;
  totalTransactions: number;
  mostUsed: Category | null;
}

export async function getCategoryStats(userId: string): Promise<CategoryStats> {
  const [totalCategories, totalTransactions, grouped] = await Promise.all([
    prisma.category.count({ where: { userId } }),
    // Includes uncategorized rows, so it will not always equal the sum of every
    // transactionCount. backend.md section 5.
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const highest = Math.max(0, ...grouped.map((row) => row._count._all));
  const tied = grouped
    .filter((row) => row._count._all === highest)
    .map((row) => row.categoryId)
    .filter((id): id is string => id !== null);

  // Ties break by name ascending, so two requests with the same data give the
  // same answer. Null when nothing is categorized: there is no most-used
  // category to name.
  const mostUsed = tied.length
    ? await prisma.category.findFirst({
        where: { userId, id: { in: tied } },
        orderBy: { name: 'asc' },
      })
    : null;

  return { totalCategories, totalTransactions, mostUsed };
}

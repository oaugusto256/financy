import type { Category } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { badUserInput, notFound } from '../../shared/errors.js';
import { parseInput } from '../auth/validation.js';
import { createCategorySchema, updateCategorySchema } from './validation.js';

const DUPLICATE_NAME = 'Já existe uma categoria com esse nome';

function duplicateName() {
  // No dedicated error code: the frontend already renders fieldErrors on the
  // field they name. backend.md section 7 records this.
  return badUserInput(DUPLICATE_NAME, { name: [DUPLICATE_NAME] });
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

  return prisma.category.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
    },
  });
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

  const { count } = await prisma.category.updateMany({
    where: { id, userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
    },
  });
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

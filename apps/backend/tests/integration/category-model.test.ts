import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { createCategory, createTransaction, createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Category model', () => {
  it('stores icon and color as tokens', async () => {
    const { user } = await createUser();

    const category = await createCategory(user.id, {
      name: 'Mercado',
      icon: 'SHOPPING_CART',
      color: 'GREEN',
    });

    expect(category.icon).toBe('SHOPPING_CART');
    expect(category.color).toBe('GREEN');
    expect(category.description).toBeNull();
  });

  it('rejects two categories with the same name for one user', async () => {
    const { user } = await createUser();
    await createCategory(user.id, { name: 'Mercado' });

    await expect(
      createCategory(user.id, { name: 'Mercado' }),
    ).rejects.toThrow();
  });

  it('lets two different users each have the same category name', async () => {
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();

    await createCategory(ana.id, { name: 'Mercado' });
    const brunos = await createCategory(bruno.id, { name: 'Mercado' });

    expect(brunos.name).toBe('Mercado');
  });

  it('deletes a user and their categories and transactions with them', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    await createTransaction(user.id, { categoryId: category.id });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.category.count()).toBe(0);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('unlinks transactions instead of deleting them when a category goes', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    const transaction = await createTransaction(user.id, {
      categoryId: category.id,
    });

    await prisma.category.delete({ where: { id: category.id } });

    // History is the most valuable thing in this system. backend.md section 4.
    const survivor = await prisma.transaction.findUnique({
      where: { id: transaction.id },
    });
    expect(survivor?.categoryId).toBeNull();
  });
});

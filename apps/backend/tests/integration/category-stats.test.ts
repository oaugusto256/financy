import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { createLoaders } from '../../src/shared/dataloaders.js';
import { getCategoryStats } from '../../src/modules/category/service.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createCategory,
  createTransaction,
  createUser,
} from '../helpers/factories.js';

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('category totals loader', () => {
  it('counts and sums a category transactions', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    await createTransaction(user.id, { categoryId: category.id, amount: 1500 });
    await createTransaction(user.id, { categoryId: category.id, amount: 2500 });

    const totals = await createLoaders(user.id).categoryTotals.load(
      category.id,
    );

    expect(totals).toEqual({ transactionCount: 2, totalAmount: 4000 });
  });

  it('returns zeros for a category with no transactions', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);

    const totals = await createLoaders(user.id).categoryTotals.load(
      category.id,
    );

    expect(totals).toEqual({ transactionCount: 0, totalAmount: 0 });
  });

  it('sums income and expense together, unsigned', async () => {
    // backend.md section 5: a category is neutral, so this is a volume figure
    // rather than a net one.
    const { user } = await createUser();
    const category = await createCategory(user.id);
    await createTransaction(user.id, {
      categoryId: category.id,
      amount: 1000,
      type: 'INCOME',
    });
    await createTransaction(user.id, {
      categoryId: category.id,
      amount: 400,
      type: 'EXPENSE',
    });

    const totals = await createLoaders(user.id).categoryTotals.load(
      category.id,
    );

    expect(totals).toEqual({ transactionCount: 2, totalAmount: 1400 });
  });

  it('never counts another user transactions', async () => {
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();
    const anas = await createCategory(ana.id);
    await createTransaction(ana.id, { categoryId: anas.id, amount: 999 });

    const totals = await createLoaders(bruno.id).categoryTotals.load(anas.id);

    expect(totals).toEqual({ transactionCount: 0, totalAmount: 0 });
  });

  it('batches many categories into one grouped query and each result is correct', async () => {
    // prisma.ts constructs the client with log: ['warn', 'error'] (or just
    // ['error']), never the event-emit form, so `prisma.$on('query', ...)` has
    // no 'query' event to listen to here. Correctness under batching (every
    // key maps back to its own category) and the "one grouped query" claim
    // are two separate properties — loadMany alone would also pass for a
    // loader that ran one query per id and still returned the right answer,
    // so the query count is asserted directly on the Prisma call rather than
    // inferred from DataLoader's own batching contract.
    const groupBy = vi.spyOn(prisma.transaction, 'groupBy');

    try {
      const { user } = await createUser();
      const categories = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          createCategory(user.id, {
            name: `Categoria ${String(index).padStart(2, '0')}`,
          }),
        ),
      );
      await Promise.all(
        categories.map((category, index) =>
          createTransaction(user.id, {
            categoryId: category.id,
            amount: (index + 1) * 100,
          }),
        ),
      );

      const loaders = createLoaders(user.id);
      const totals = await loaders.categoryTotals.loadMany(
        categories.map((category) => category.id),
      );

      totals.forEach((totalsForCategory, index) => {
        expect(totalsForCategory).toEqual({
          transactionCount: 1,
          totalAmount: (index + 1) * 100,
        });
      });
      expect(groupBy).toHaveBeenCalledTimes(1);
    } finally {
      groupBy.mockRestore();
    }
  });
});

describe('getCategoryStats', () => {
  it('is all zeros and null for a new user', async () => {
    const { user } = await createUser();

    expect(await getCategoryStats(user.id)).toEqual({
      totalCategories: 0,
      totalTransactions: 0,
      mostUsed: null,
    });
  });

  it('counts uncategorized transactions in totalTransactions', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    await createTransaction(user.id, { categoryId: category.id });
    await createTransaction(user.id, { categoryId: null });

    const stats = await getCategoryStats(user.id);

    // backend.md section 5: this will not always equal the sum of every
    // transactionCount.
    expect(stats.totalTransactions).toBe(2);
    expect(stats.totalCategories).toBe(1);
  });

  it('returns the category with the most transactions', async () => {
    const { user } = await createUser();
    const busy = await createCategory(user.id, { name: 'Mercado' });
    const quiet = await createCategory(user.id, { name: 'Lazer' });
    await createTransaction(user.id, { categoryId: busy.id });
    await createTransaction(user.id, { categoryId: busy.id });
    await createTransaction(user.id, { categoryId: quiet.id });

    expect((await getCategoryStats(user.id)).mostUsed?.name).toBe('Mercado');
  });

  it('breaks a tie by name ascending so the answer is stable', async () => {
    const { user } = await createUser();
    const zeta = await createCategory(user.id, { name: 'Zeta' });
    const alfa = await createCategory(user.id, { name: 'Alfa' });
    await createTransaction(user.id, { categoryId: zeta.id });
    await createTransaction(user.id, { categoryId: alfa.id });

    expect((await getCategoryStats(user.id)).mostUsed?.name).toBe('Alfa');
  });

  it('is null when every transaction is uncategorized', async () => {
    const { user } = await createUser();
    await createCategory(user.id);
    await createTransaction(user.id, { categoryId: null });

    expect((await getCategoryStats(user.id)).mostUsed).toBeNull();
  });

  it('never counts another user rows', async () => {
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();
    const anas = await createCategory(ana.id);
    await createTransaction(ana.id, { categoryId: anas.id });

    expect(await getCategoryStats(bruno.id)).toEqual({
      totalCategories: 0,
      totalTransactions: 0,
      mostUsed: null,
    });
  });
});

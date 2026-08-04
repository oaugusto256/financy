import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from '../../src/modules/transaction/service.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createCategory,
  createTransaction as seedTransaction,
  createUser,
} from '../helpers/factories.js';

beforeEach(resetDatabase);

const DATE = new Date('2026-08-04T15:00:00.000Z');

describe('createTransaction', () => {
  it('stores a transaction owned by the caller', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);

    const created = await createTransaction(user.id, {
      description: 'Mercado do mês',
      amount: 12_345,
      type: 'EXPENSE',
      date: DATE,
      categoryId: category.id,
    });

    expect(created).toMatchObject({
      userId: user.id,
      description: 'Mercado do mês',
      amount: 12_345,
      type: 'EXPENSE',
      categoryId: category.id,
    });
    expect(created.date.toISOString()).toBe(DATE.toISOString());
  });

  it('stores an uncategorized transaction', async () => {
    const { user } = await createUser();

    const created = await createTransaction(user.id, {
      description: 'Troco',
      amount: 500,
      type: 'INCOME',
      date: DATE,
    });

    expect(created.categoryId).toBeNull();
  });

  it('validates before writing anything', async () => {
    const { user } = await createUser();

    await expect(
      createTransaction(user.id, {
        description: '   ',
        amount: 100,
        type: 'EXPENSE',
        date: DATE,
      }),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });

    expect(await prisma.transaction.count()).toBe(0);
  });

  it('refuses another user’s category with NOT_FOUND', async () => {
    // FORBIDDEN would confirm the id exists. backend.md section 6.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirCategory = await createCategory(other.id);

    await expect(
      createTransaction(owner.id, {
        description: 'Tentativa',
        amount: 100,
        type: 'EXPENSE',
        date: DATE,
        categoryId: theirCategory.id,
      }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

    expect(await prisma.transaction.count()).toBe(0);
  });

  it('refuses a category id that belongs to nobody', async () => {
    const { user } = await createUser();

    await expect(
      createTransaction(user.id, {
        description: 'Tentativa',
        amount: 100,
        type: 'EXPENSE',
        date: DATE,
        categoryId: 'does-not-exist',
      }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });
});

describe('getTransaction', () => {
  it('returns the caller’s own transaction', async () => {
    const { user } = await createUser();
    const seeded = await seedTransaction(user.id);

    expect((await getTransaction(user.id, seeded.id)).id).toBe(seeded.id);
  });

  it('answers NOT_FOUND for another user’s transaction', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await seedTransaction(other.id);

    await expect(getTransaction(owner.id, theirs.id)).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });
});

describe('updateTransaction', () => {
  it('applies only the fields it was given', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    const seeded = await seedTransaction(user.id, {
      categoryId: category.id,
      description: 'Antes',
      amount: 100,
    });

    const updated = await updateTransaction(user.id, seeded.id, {
      description: 'Depois',
    });

    expect(updated.description).toBe('Depois');
    expect(updated.amount).toBe(100);
    expect(updated.categoryId).toBe(category.id);
  });

  it('clears the category when told to, and leaves it alone when not', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    const seeded = await seedTransaction(user.id, { categoryId: category.id });

    const untouched = await updateTransaction(user.id, seeded.id, {
      amount: 999,
    });
    expect(untouched.categoryId).toBe(category.id);

    const cleared = await updateTransaction(user.id, seeded.id, {
      categoryId: null,
    });
    expect(cleared.categoryId).toBeNull();
  });

  it('answers NOT_FOUND for another user’s transaction', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await seedTransaction(other.id, { description: 'Deles' });

    await expect(
      updateTransaction(owner.id, theirs.id, { description: 'Meu agora' }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

    expect(
      (
        await prisma.transaction.findUniqueOrThrow({
          where: { id: theirs.id },
        })
      ).description,
    ).toBe('Deles');
  });

  it('refuses to move a transaction into another user’s category', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const seeded = await seedTransaction(owner.id);
    const theirCategory = await createCategory(other.id);

    await expect(
      updateTransaction(owner.id, seeded.id, {
        categoryId: theirCategory.id,
      }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });

  it('reports an id it does not own before it reports a bad category', async () => {
    // Existence first. Checking the category first would answer NOT_FOUND for
    // the category on a request whose real problem is the transaction id — the
    // same code, but naming the wrong resource.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await seedTransaction(other.id);

    await expect(
      updateTransaction(owner.id, theirs.id, { categoryId: 'nonsense' }),
    ).rejects.toMatchObject({ message: 'Transação não encontrado' });
  });
});

describe('deleteTransaction', () => {
  it('deletes the caller’s own transaction', async () => {
    const { user } = await createUser();
    const seeded = await seedTransaction(user.id);

    expect(await deleteTransaction(user.id, seeded.id)).toBe(true);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('answers NOT_FOUND for another user’s transaction and leaves it standing', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await seedTransaction(other.id);

    await expect(deleteTransaction(owner.id, theirs.id)).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });

    expect(await prisma.transaction.count()).toBe(1);
  });
});

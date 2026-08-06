import { beforeEach, describe, expect, it } from 'vitest';
import { listTransactions } from '../../src/modules/transaction/service.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createCategory,
  createTransaction,
  createUser,
} from '../helpers/factories.js';

beforeEach(resetDatabase);

/**
 * One user with four transactions that differ in every filterable dimension,
 * so a filter that is silently ignored returns four rows instead of one and
 * every assertion below fails.
 */
async function seedFixture() {
  const { user } = await createUser();
  const mercado = await createCategory(user.id, { name: 'Mercado' });
  const salario = await createCategory(user.id, { name: 'Salário' });

  await createTransaction(user.id, {
    description: 'Compras no mercado',
    type: 'EXPENSE',
    categoryId: mercado.id,
    amount: 15_000,
    date: new Date(Date.UTC(2026, 6, 10, 12, 0, 0)), // July
  });
  await createTransaction(user.id, {
    description: 'Salário de agosto',
    type: 'INCOME',
    categoryId: salario.id,
    amount: 500_000,
    date: new Date(Date.UTC(2026, 7, 5, 12, 0, 0)), // August
  });
  await createTransaction(user.id, {
    description: 'Conta de luz',
    type: 'EXPENSE',
    categoryId: null,
    amount: 12_000,
    date: new Date(Date.UTC(2026, 7, 20, 12, 0, 0)), // August
  });
  await createTransaction(user.id, {
    description: 'MERCADO da esquina',
    type: 'EXPENSE',
    categoryId: mercado.id,
    amount: 4_000,
    date: new Date(Date.UTC(2026, 7, 25, 12, 0, 0)), // August
  });

  return { user, mercado, salario };
}

function descriptions(page: { items: { description: string }[] }) {
  return page.items.map((item) => item.description).sort();
}

describe('listTransactions with a filter', () => {
  it('matches a description substring', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { search: 'esquina' },
    });

    expect(descriptions(page)).toEqual(['MERCADO da esquina']);
    expect(page.totalCount).toBe(1);
  });

  it('matches regardless of case', async () => {
    // SQLite's LIKE is case-insensitive for ASCII, which is the whole
    // mechanism here — there is no `mode: 'insensitive'` on this client.
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { search: 'mercado' },
    });

    expect(descriptions(page)).toEqual([
      'Compras no mercado',
      'MERCADO da esquina',
    ]);
  });

  it('filters by type', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { type: 'INCOME' },
    });

    expect(descriptions(page)).toEqual(['Salário de agosto']);
    expect(page.totalCount).toBe(1);
  });

  it('filters by category', async () => {
    const { user, mercado } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { categoryId: mercado.id },
    });

    expect(descriptions(page)).toEqual([
      'Compras no mercado',
      'MERCADO da esquina',
    ]);
  });

  it('filters by an inclusive date range', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: {
        dateFrom: new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
        dateTo: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
      },
    });

    expect(descriptions(page)).toEqual([
      'Conta de luz',
      'MERCADO da esquina',
      'Salário de agosto',
    ]);
  });

  it('includes a row sitting exactly on each bound', async () => {
    // The boundary the period select relies on: a transaction on the last day
    // of the month belongs to that month. `lt` instead of `lte` drops it, and
    // a month-end row is exactly the one a user goes looking for.
    const { user } = await createUser();
    const edge = new Date(Date.UTC(2026, 7, 31, 12, 0, 0));
    await createTransaction(user.id, { description: 'Último dia', date: edge });

    const page = await listTransactions(user.id, {
      filter: { dateFrom: edge, dateTo: edge },
    });

    expect(descriptions(page)).toEqual(['Último dia']);
  });

  it('combines every filter with AND, not OR', async () => {
    const { user, mercado } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: {
        search: 'mercado',
        type: 'EXPENSE',
        categoryId: mercado.id,
        dateFrom: new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
        dateTo: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
      },
    });

    // 'Compras no mercado' matches the search, the type and the category, and
    // is excluded only by the date. An OR anywhere in the where clause returns
    // it too.
    expect(descriptions(page)).toEqual(['MERCADO da esquina']);
    expect(page.totalCount).toBe(1);
  });

  it('counts the filtered set, not the whole one', async () => {
    // The defect this guards: applying the filter to findMany but not to
    // count. The page would hold one row while the footer read "27
    // resultados" and the pagination offered three pages of nothing.
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: { type: 'INCOME' },
      limit: 10,
    });

    expect(page.items).toHaveLength(1);
    expect(page.totalCount).toBe(1);
  });

  it('paginates within the filtered set', async () => {
    const { user } = await createUser();
    for (let day = 1; day <= 5; day += 1) {
      await createTransaction(user.id, {
        description: `Mercado ${day}`,
        date: new Date(Date.UTC(2026, 7, day, 12, 0, 0)),
      });
      await createTransaction(user.id, {
        description: `Outro ${day}`,
        date: new Date(Date.UTC(2026, 7, day, 13, 0, 0)),
      });
    }

    const page = await listTransactions(user.id, {
      filter: { search: 'Mercado' },
      limit: 2,
      offset: 2,
    });

    expect(page.items).toHaveLength(2);
    expect(page.totalCount).toBe(5);
    // date DESC: Mercado 5, 4 | 3, 2 | 1.
    expect(descriptions(page)).toEqual(['Mercado 2', 'Mercado 3']);
  });

  it('never reaches another user’s rows through a filter', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    await createTransaction(owner.id, { description: 'Mercado do dono' });
    await createTransaction(other.id, { description: 'Mercado do outro' });

    const page = await listTransactions(owner.id, {
      filter: { search: 'Mercado' },
    });

    expect(descriptions(page)).toEqual(['Mercado do dono']);
    expect(page.totalCount).toBe(1);
  });

  it('returns an empty page for another user’s category rather than NOT_FOUND', async () => {
    // Deliberate: userId is in the same where clause, so nothing can match.
    // NOT_FOUND would confirm whether the id exists, which is what ownership
    // hides. Nothing is being attached here, unlike create and update.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const foreign = await createCategory(other.id, { name: 'Alheia' });
    await createTransaction(owner.id, {});
    await createTransaction(other.id, { categoryId: foreign.id });

    const page = await listTransactions(owner.id, {
      filter: { categoryId: foreign.id },
    });

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
  });

  it('returns an empty page when the range is inverted', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, {
      filter: {
        dateFrom: new Date(Date.UTC(2026, 7, 31, 0, 0, 0)),
        dateTo: new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
      },
    });

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
  });

  it('ignores an empty filter object', async () => {
    const { user } = await seedFixture();

    const page = await listTransactions(user.id, { filter: {} });

    expect(page.totalCount).toBe(4);
  });

  it('surfaces an invalid filter as BAD_USER_INPUT', async () => {
    const { user } = await createUser();

    await expect(
      listTransactions(user.id, { filter: { search: 'a'.repeat(101) } }),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
  });
});

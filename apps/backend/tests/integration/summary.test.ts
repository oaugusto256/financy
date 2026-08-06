import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { getSummary } from '../../src/modules/summary/service.js';
import { resetDatabase } from '../helpers/db.js';
import { createTransaction, createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

/** Noon UTC, so no timezone the suite could run under moves the day. */
const utc = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

describe('getSummary', () => {
  it('is all zeros for a user with no transactions', async () => {
    const { user } = await createUser();

    expect(await getSummary(user.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: 0,
      monthIncome: 0,
      monthExpense: 0,
    });
  });

  it('returns a month with no transactions as zeros rather than null', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 5_000,
      type: 'INCOME',
      date: utc(2026, 7, 10),
    });

    expect(await getSummary(user.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: 5_000,
      monthIncome: 0,
      monthExpense: 0,
    });
  });

  it('sums income and expense within the requested month', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 780_000,
      type: 'INCOME',
      date: utc(2026, 8, 5),
    });
    await createTransaction(user.id, {
      amount: 210_000,
      type: 'EXPENSE',
      date: utc(2026, 8, 5),
    });
    await createTransaction(user.id, {
      amount: 34_215,
      type: 'EXPENSE',
      date: utc(2026, 8, 20),
    });

    expect(await getSummary(user.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: 535_785,
      monthIncome: 780_000,
      // Unsigned: the dashboard card renders the minus sign.
      monthExpense: 244_215,
    });
  });

  it('spans months in totalBalance and only the month in the two month figures', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 100_000,
      type: 'INCOME',
      date: utc(2026, 1, 15),
    });
    await createTransaction(user.id, {
      amount: 40_000,
      type: 'EXPENSE',
      date: utc(2026, 12, 15),
    });
    await createTransaction(user.id, {
      amount: 7_000,
      type: 'EXPENSE',
      date: utc(2026, 8, 15),
    });

    expect(await getSummary(user.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: 53_000,
      monthIncome: 0,
      monthExpense: 7_000,
    });
  });

  it('includes both edges of the month and neither neighbour', async () => {
    const { user } = await createUser();
    // The first and last instants of August 2026 in UTC, and the instants one
    // millisecond outside each.
    await prisma.transaction.createMany({
      data: [
        { d: new Date(Date.UTC(2026, 7, 1, 0, 0, 0, 0)), a: 1 },
        { d: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)), a: 2 },
        { d: new Date(Date.UTC(2026, 6, 31, 23, 59, 59, 999)), a: 400 },
        { d: new Date(Date.UTC(2026, 8, 1, 0, 0, 0, 0)), a: 800 },
      ].map(({ d, a }) => ({
        userId: user.id,
        description: 'Limite',
        amount: a,
        type: 'EXPENSE',
        date: d,
      })),
    });

    const summary = await getSummary(user.id, { month: 8, year: 2026 });

    expect(summary.monthExpense).toBe(3);
    expect(summary.totalBalance).toBe(-1_203);
  });

  it('does not leak January of the following year into December', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 900,
      type: 'EXPENSE',
      date: utc(2026, 12, 31),
    });
    await createTransaction(user.id, {
      amount: 500,
      type: 'EXPENSE',
      date: utc(2027, 1, 1),
    });

    expect(
      (await getSummary(user.id, { month: 12, year: 2026 })).monthExpense,
    ).toBe(900);
  });

  it('does not leak the previous December into January', async () => {
    const { user } = await createUser();
    await createTransaction(user.id, {
      amount: 900,
      type: 'EXPENSE',
      date: utc(2025, 12, 31),
    });
    await createTransaction(user.id, {
      amount: 500,
      type: 'EXPENSE',
      date: utc(2026, 1, 1),
    });

    expect(
      (await getSummary(user.id, { month: 1, year: 2026 })).monthExpense,
    ).toBe(500);
  });

  it('never counts another user rows', async () => {
    // Asserted as the caller's own figures being unchanged, not as NOT_FOUND:
    // summary takes no id, so there is nothing to miss. Same reasoning slice 4
    // recorded for a foreign categoryId in a filter.
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();
    await createTransaction(ana.id, {
      amount: 999_999,
      type: 'INCOME',
      date: utc(2026, 8, 10),
    });
    await createTransaction(bruno.id, {
      amount: 1_000,
      type: 'EXPENSE',
      date: utc(2026, 8, 10),
    });

    expect(await getSummary(bruno.id, { month: 8, year: 2026 })).toEqual({
      totalBalance: -1_000,
      monthIncome: 0,
      monthExpense: 1_000,
    });
  });

  it('rejects an out-of-range month before it reaches Prisma', async () => {
    const { user } = await createUser();

    await expect(
      getSummary(user.id, { month: 13, year: 2026 }),
    ).rejects.toThrow('O mês deve estar entre 1 e 12');
  });
});

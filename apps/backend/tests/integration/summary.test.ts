import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { GraphQLContext } from '../../src/context.js';
import { prisma } from '../../src/shared/prisma.js';
import { signToken } from '../../src/shared/jwt.js';
import { getSummary } from '../../src/modules/summary/service.js';
import { resetDatabase } from '../helpers/db.js';
import { createTransaction, createUser } from '../helpers/factories.js';
import { errorCode, execute } from '../helpers/graphql.js';

let app: Express;
let apollo: ApolloServer<GraphQLContext>;

const SUMMARY = /* GraphQL */ `
  query Summary($month: Int!, $year: Int!) {
    summary(month: $month, year: $year) {
      totalBalance
      monthIncome
      monthExpense
    }
  }
`;

async function signedIn() {
  const { user } = await createUser();
  return { user, token: await signToken(user.id) };
}

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

beforeEach(resetDatabase);

afterAll(async () => {
  await apollo.stop();
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

describe('the summary query', () => {
  it('answers the caller’s three figures', async () => {
    const { user, token } = await signedIn();
    await createTransaction(user.id, {
      amount: 300_000,
      type: 'INCOME',
      date: utc(2026, 8, 5),
    });
    await createTransaction(user.id, {
      amount: 120_000,
      type: 'EXPENSE',
      date: utc(2026, 8, 6),
    });
    await createTransaction(user.id, {
      amount: 50_000,
      type: 'EXPENSE',
      date: utc(2026, 7, 6),
    });

    const body = await execute(app, {
      query: SUMMARY,
      variables: { month: 8, year: 2026 },
      token,
    });

    expect(body.data?.summary).toEqual({
      totalBalance: 130_000,
      monthIncome: 300_000,
      monthExpense: 120_000,
    });
  });

  it('answers zeros, not null and not an error, for an empty month', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: SUMMARY,
      variables: { month: 2, year: 2026 },
      token,
    });

    expect(body.errors).toBeUndefined();
    expect(body.data?.summary).toEqual({
      totalBalance: 0,
      monthIncome: 0,
      monthExpense: 0,
    });
  });

  it('rejects an unauthenticated caller', async () => {
    const body = await execute(app, {
      query: SUMMARY,
      variables: { month: 8, year: 2026 },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });

  it('answers BAD_USER_INPUT for each out-of-range argument', async () => {
    const { token } = await signedIn();

    for (const variables of [
      { month: 0, year: 2026 },
      { month: 13, year: 2026 },
      { month: 8, year: 1969 },
      { month: 8, year: 10_000 },
    ]) {
      const body = await execute(app, { query: SUMMARY, variables, token });
      expect(errorCode(body)).toBe('BAD_USER_INPUT');
    }
  });

  it('never shows one user another user’s figures', async () => {
    const { user: ana } = await createUser();
    const { token } = await signedIn();
    await createTransaction(ana.id, {
      amount: 999_999,
      type: 'INCOME',
      date: utc(2026, 8, 10),
    });

    const body = await execute(app, {
      query: SUMMARY,
      variables: { month: 8, year: 2026 },
      token,
    });

    expect(body.data?.summary).toEqual({
      totalBalance: 0,
      monthIncome: 0,
      monthExpense: 0,
    });
  });
});

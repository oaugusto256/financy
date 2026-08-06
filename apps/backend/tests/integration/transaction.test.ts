import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApp } from '../../src/app.js';
import type { GraphQLContext } from '../../src/context.js';
import { prisma } from '../../src/shared/prisma.js';
import { signToken } from '../../src/shared/jwt.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createCategory,
  createTransaction,
  createUser,
} from '../helpers/factories.js';
import { errorCode, execute } from '../helpers/graphql.js';

let app: Express;
let apollo: ApolloServer<GraphQLContext>;

const TRANSACTIONS = /* GraphQL */ `
  query Transactions($limit: Int, $offset: Int) {
    transactions(limit: $limit, offset: $offset) {
      totalCount
      items {
        id
        description
        amount
        type
        date
        category {
          id
          name
          color
        }
      }
    }
  }
`;

const FILTERED_TRANSACTIONS = /* GraphQL */ `
  query Transactions($filter: TransactionFilter, $limit: Int, $offset: Int) {
    transactions(filter: $filter, limit: $limit, offset: $offset) {
      totalCount
      items {
        id
        description
      }
    }
  }
`;

const CREATE_TRANSACTION = /* GraphQL */ `
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      id
      description
      amount
      type
      date
      category {
        id
        name
      }
    }
  }
`;

const UPDATE_TRANSACTION = /* GraphQL */ `
  mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      id
      description
      amount
      category {
        id
      }
    }
  }
`;

const DELETE_TRANSACTION = /* GraphQL */ `
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

afterAll(async () => {
  await apollo.stop();
});

beforeEach(resetDatabase);

async function signedIn() {
  const { user } = await createUser();
  return { user, token: await signToken(user.id) };
}

describe('transactions', () => {
  it('returns a page of the caller’s transactions with their categories', async () => {
    const { user, token } = await signedIn();
    const category = await createCategory(user.id, { name: 'Casa' });
    await createTransaction(user.id, {
      description: 'Aluguel',
      amount: 150_000,
      type: 'EXPENSE',
      categoryId: category.id,
      date: new Date(Date.UTC(2026, 6, 10, 12, 0, 0)),
    });

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      totalCount: number;
      items: {
        description: string;
        amount: number;
        type: string;
        category: { name: string } | null;
      }[];
    };

    expect(page.totalCount).toBe(1);
    expect(page.items[0]).toMatchObject({
      description: 'Aluguel',
      amount: 150_000,
      type: 'EXPENSE',
      category: { name: 'Casa' },
    });
  });

  it('renders an uncategorized transaction with a null category', async () => {
    const { user, token } = await signedIn();
    await createTransaction(user.id, { categoryId: null });

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      items: { category: unknown }[];
    };

    expect(page.items[0]?.category).toBeNull();
  });

  it('renders a null category once the category is deleted', async () => {
    // onDelete: SetNull. The row survives with no category rather than being
    // deleted with it — history is the most valuable thing in this system.
    const { user, token } = await signedIn();
    const category = await createCategory(user.id);
    await createTransaction(user.id, { categoryId: category.id });

    await prisma.category.delete({ where: { id: category.id } });

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      totalCount: number;
      items: { category: unknown }[];
    };

    expect(page.totalCount).toBe(1);
    expect(page.items[0]?.category).toBeNull();
  });

  it('defaults to ten rows and reports the full count', async () => {
    const { user, token } = await signedIn();
    for (let day = 1; day <= 27; day += 1) {
      await createTransaction(user.id, {
        date: new Date(Date.UTC(2026, 6, day, 12, 0, 0)),
      });
    }

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      totalCount: number;
      items: unknown[];
    };

    expect(page.items).toHaveLength(10);
    expect(page.totalCount).toBe(27);
  });

  it('never shows another user’s rows', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    await createTransaction(other.id);

    const body = await execute(app, { query: TRANSACTIONS, token });
    const page = body.data?.transactions as {
      totalCount: number;
      items: unknown[];
    };

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
  });

  it('honors limit and offset, ordering by date descending', async () => {
    // The teeth this test needs: every other case in this file either omits
    // limit/offset (the default) or only exercises the default's row count,
    // so a resolver that dropped `args` entirely — listTransactions(userId, {})
    // — would still pass them all. Requesting a specific offset and checking
    // which rows land there is the only way to prove the arguments are wired
    // through. The exact dates returned also pin the `date desc, createdAt
    // desc` ordering service.ts documents as load-bearing.
    const { user, token } = await signedIn();
    for (let day = 1; day <= 27; day += 1) {
      await createTransaction(user.id, {
        date: new Date(Date.UTC(2026, 6, day, 12, 0, 0)),
      });
    }

    const firstPage = await execute(app, {
      query: TRANSACTIONS,
      token,
      variables: { limit: 5, offset: 0 },
    });
    const firstIds = new Set(
      (firstPage.data?.transactions as { items: { id: string }[] }).items.map(
        (item) => item.id,
      ),
    );

    const body = await execute(app, {
      query: TRANSACTIONS,
      token,
      variables: { limit: 5, offset: 5 },
    });
    const page = body.data?.transactions as {
      totalCount: number;
      items: { id: string; date: string }[];
    };

    expect(page.totalCount).toBe(27);
    expect(page.items).toHaveLength(5);
    expect(page.items.some((item) => firstIds.has(item.id))).toBe(false);
    // Ordered by date desc: offset 5 skips the five newest (days 27-23) and
    // lands on days 22 down to 18.
    expect(page.items.map((item) => item.date)).toEqual(
      [22, 21, 20, 19, 18].map((day) =>
        new Date(Date.UTC(2026, 6, day, 12, 0, 0)).toISOString(),
      ),
    );
  });

  it('resolves the page’s categories through one loader call, not one per row', async () => {
    // The teeth this test needs: Transaction.category swapped for a per-row
    // prisma.category.findFirst would return identical data and pass every
    // other test in this file — the N+1 is invisible to anything that only
    // checks the response body. Spying on the loader's own query is the only
    // way to catch it. Ten distinct categories, not one repeated: a single
    // shared category would collapse to one key regardless of whether the
    // loader or a per-row query served it.
    const { user, token } = await signedIn();
    for (let day = 1; day <= 10; day += 1) {
      const category = await createCategory(user.id, {
        name: `Categoria ${day}`,
      });
      await createTransaction(user.id, {
        categoryId: category.id,
        date: new Date(Date.UTC(2026, 6, day, 12, 0, 0)),
      });
    }

    const spy = vi.spyOn(prisma.category, 'findMany');

    try {
      const body = await execute(app, { query: TRANSACTIONS, token });
      const page = body.data?.transactions as {
        items: { category: { name: string } | null }[];
      };

      expect(page.items).toHaveLength(10);
      expect(page.items.every((item) => item.category !== null)).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('requires a token', async () => {
    const body = await execute(app, { query: TRANSACTIONS });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('transactions(filter:)', () => {
  it('narrows the page and its count together', async () => {
    const { user, token } = await signedIn();
    await createTransaction(user.id, { description: 'Mercado' });
    await createTransaction(user.id, { description: 'Aluguel' });

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'Merc' } },
      token,
    });

    expect(body.data?.transactions).toEqual({
      totalCount: 1,
      items: [expect.objectContaining({ description: 'Mercado' })],
    });
  });

  it('accepts a filter beside limit and offset', async () => {
    // The arguments have to coexist: an SDL that declares `filter` in place of
    // the pagination arguments, or a resolver that forwards only one of them,
    // passes every single-argument test.
    const { user, token } = await signedIn();
    for (let day = 1; day <= 3; day += 1) {
      await createTransaction(user.id, {
        description: `Mercado ${day}`,
        date: new Date(Date.UTC(2026, 7, day, 12, 0, 0)),
      });
    }

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'Mercado' }, limit: 1, offset: 1 },
      token,
    });

    expect(body.data?.transactions).toMatchObject({
      totalCount: 3,
      items: [expect.objectContaining({ description: 'Mercado 2' })],
    });
  });

  it('rejects a search over the limit as BAD_USER_INPUT', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'a'.repeat(101) } },
      token,
    });

    expect(errorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('rejects an unknown filter field at the schema level', async () => {
    // Guards the input's shape: a filter typed as a free-form scalar would
    // accept this and quietly ignore it.
    const { token } = await signedIn();

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { minimumAmount: 100 } },
      token,
    });

    expect(body.errors?.length).toBeGreaterThan(0);
  });

  it('still requires authentication with a filter present', async () => {
    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'Mercado' } },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });

  it('does not reach another user’s rows through a filter', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    await createTransaction(other.id, { description: 'Mercado alheio' });

    const body = await execute(app, {
      query: FILTERED_TRANSACTIONS,
      variables: { filter: { search: 'Mercado' } },
      token,
    });

    expect(body.data?.transactions).toEqual({ totalCount: 0, items: [] });
  });
});

describe('createTransaction', () => {
  it('creates a transaction for the caller', async () => {
    const { user, token } = await signedIn();
    const category = await createCategory(user.id, { name: 'Mercado' });

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: 'Compras da semana',
          amount: 8_990,
          type: 'EXPENSE',
          date: '2026-08-04T15:00:00.000Z',
          categoryId: category.id,
        },
      },
    });

    expect(body.data?.createTransaction).toMatchObject({
      description: 'Compras da semana',
      amount: 8_990,
      type: 'EXPENSE',
      category: { name: 'Mercado' },
    });
  });

  it('creates an uncategorized transaction', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: 'Troco',
          amount: 500,
          type: 'INCOME',
          date: '2026-08-04T15:00:00.000Z',
        },
      },
    });

    expect(
      (body.data?.createTransaction as { category: unknown }).category,
    ).toBeNull();
  });

  it('rejects an empty description', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: '   ',
          amount: 500,
          type: 'INCOME',
          date: '2026-08-04T15:00:00.000Z',
        },
      },
    });

    expect(errorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('rejects a zero amount', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: 'Nada',
          amount: 0,
          type: 'INCOME',
          date: '2026-08-04T15:00:00.000Z',
        },
      },
    });

    expect(errorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('answers NOT_FOUND for another user’s category', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    const theirCategory = await createCategory(other.id);

    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      token,
      variables: {
        input: {
          description: 'Tentativa',
          amount: 100,
          type: 'EXPENSE',
          date: '2026-08-04T15:00:00.000Z',
          categoryId: theirCategory.id,
        },
      },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('requires a token', async () => {
    const body = await execute(app, {
      query: CREATE_TRANSACTION,
      variables: {
        input: {
          description: 'Sem sessão',
          amount: 100,
          type: 'EXPENSE',
          date: '2026-08-04T15:00:00.000Z',
        },
      },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('updateTransaction', () => {
  it('updates the caller’s own transaction', async () => {
    const { user, token } = await signedIn();
    const seeded = await createTransaction(user.id, { description: 'Antes' });

    const body = await execute(app, {
      query: UPDATE_TRANSACTION,
      token,
      variables: { id: seeded.id, input: { description: 'Depois' } },
    });

    expect(body.data?.updateTransaction).toMatchObject({
      description: 'Depois',
    });
  });

  it('answers NOT_FOUND for another user’s transaction', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    const theirs = await createTransaction(other.id, { description: 'Deles' });

    const body = await execute(app, {
      query: UPDATE_TRANSACTION,
      token,
      variables: { id: theirs.id, input: { description: 'Meu agora' } },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
  });

  it('answers NOT_FOUND when moving into another user’s category', async () => {
    const { user, token } = await signedIn();
    const { user: other } = await createUser();
    const seeded = await createTransaction(user.id);
    const theirCategory = await createCategory(other.id);

    const body = await execute(app, {
      query: UPDATE_TRANSACTION,
      token,
      variables: { id: seeded.id, input: { categoryId: theirCategory.id } },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
  });

  it('requires a token', async () => {
    const { user } = await createUser();
    const seeded = await createTransaction(user.id);

    const body = await execute(app, {
      query: UPDATE_TRANSACTION,
      variables: { id: seeded.id, input: { description: 'x' } },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('deleteTransaction', () => {
  it('deletes the caller’s own transaction', async () => {
    const { user, token } = await signedIn();
    const seeded = await createTransaction(user.id);

    const body = await execute(app, {
      query: DELETE_TRANSACTION,
      token,
      variables: { id: seeded.id },
    });

    expect(body.data?.deleteTransaction).toBe(true);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('answers NOT_FOUND for another user’s transaction and leaves it standing', async () => {
    const { token } = await signedIn();
    const { user: other } = await createUser();
    const theirs = await createTransaction(other.id);

    const body = await execute(app, {
      query: DELETE_TRANSACTION,
      token,
      variables: { id: theirs.id },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
    expect(await prisma.transaction.count()).toBe(1);
  });

  it('requires a token', async () => {
    const { user } = await createUser();
    const seeded = await createTransaction(user.id);

    const body = await execute(app, {
      query: DELETE_TRANSACTION,
      variables: { id: seeded.id },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

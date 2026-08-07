import type { Express } from 'express';
import type { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

const CATEGORIES = /* GraphQL */ `
  query Categories {
    categories {
      id
      name
      description
      icon
      color
      transactionCount
      totalAmount
    }
  }
`;

const CATEGORY_STATS = /* GraphQL */ `
  query CategoryStats {
    categoryStats {
      totalCategories
      totalTransactions
      mostUsed {
        id
        name
      }
    }
  }
`;

const CREATE_CATEGORY = /* GraphQL */ `
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
      description
      icon
      color
      transactionCount
      totalAmount
    }
  }
`;

const UPDATE_CATEGORY = /* GraphQL */ `
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      id
      name
      icon
    }
  }
`;

const DELETE_CATEGORY = /* GraphQL */ `
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

beforeEach(resetDatabase);

afterAll(async () => {
  await apollo.stop();
  await prisma.$disconnect();
});

async function signedIn() {
  const { user } = await createUser();
  return { user, token: await signToken(user.id) };
}

describe('categories', () => {
  it('returns the caller categories with their aggregates', async () => {
    const { user, token } = await signedIn();
    const category = await createCategory(user.id, { name: 'Mercado' });
    await createTransaction(user.id, { categoryId: category.id, amount: 2500 });

    const body = await execute(app, { query: CATEGORIES, token });

    expect(body.data?.categories).toEqual([
      {
        id: category.id,
        name: 'Mercado',
        description: null,
        icon: 'WALLET',
        color: 'GREEN',
        transactionCount: 1,
        totalAmount: 2500,
      },
    ]);
  });

  it('never returns another user categories', async () => {
    const { token } = await signedIn();
    const { user: bruno } = await createUser();
    await createCategory(bruno.id);

    const body = await execute(app, { query: CATEGORIES, token });

    expect(body.data?.categories).toEqual([]);
  });

  it('rejects an unauthenticated request', async () => {
    const body = await execute(app, { query: CATEGORIES });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('categoryStats', () => {
  it('answers the three figures', async () => {
    const { user, token } = await signedIn();
    const category = await createCategory(user.id, { name: 'Mercado' });
    await createTransaction(user.id, { categoryId: category.id });
    await createTransaction(user.id, { categoryId: null });

    const body = await execute(app, { query: CATEGORY_STATS, token });

    expect(body.data?.categoryStats).toEqual({
      totalCategories: 1,
      totalTransactions: 2,
      mostUsed: { id: category.id, name: 'Mercado' },
    });
  });

  it('rejects an unauthenticated request', async () => {
    expect(errorCode(await execute(app, { query: CATEGORY_STATS }))).toBe(
      'UNAUTHENTICATED',
    );
  });
});

describe('createCategory', () => {
  it('creates a category and returns it with zeroed aggregates', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: CREATE_CATEGORY,
      token,
      variables: {
        input: {
          name: 'Mercado',
          description: 'Compras da semana',
          icon: 'SHOPPING_CART',
          color: 'GREEN',
        },
      },
    });

    expect(body.data?.createCategory).toMatchObject({
      name: 'Mercado',
      description: 'Compras da semana',
      icon: 'SHOPPING_CART',
      color: 'GREEN',
      transactionCount: 0,
      totalAmount: 0,
    });
  });

  it('rejects an icon outside the enum before it reaches the service', async () => {
    const { token } = await signedIn();

    const body = await execute(app, {
      query: CREATE_CATEGORY,
      token,
      variables: {
        input: { name: 'Mercado', icon: 'ROCKET', color: 'GREEN' },
      },
    });

    // GraphQL rejects the enum value itself; the request never reaches a
    // resolver.
    expect(body.errors?.[0]?.message).toMatch(/ROCKET/);
  });

  it('rejects a duplicate name on the name field', async () => {
    const { user, token } = await signedIn();
    await createCategory(user.id, { name: 'Mercado' });

    const body = await execute(app, {
      query: CREATE_CATEGORY,
      token,
      variables: {
        input: { name: 'Mercado', icon: 'WALLET', color: 'GREEN' },
      },
    });

    expect(errorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('rejects an unauthenticated request', async () => {
    const body = await execute(app, {
      query: CREATE_CATEGORY,
      variables: { input: { name: 'Mercado', icon: 'WALLET', color: 'GREEN' } },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('updateCategory', () => {
  it('updates the caller category', async () => {
    const { user, token } = await signedIn();
    const category = await createCategory(user.id, { name: 'Mercado' });

    const body = await execute(app, {
      query: UPDATE_CATEGORY,
      token,
      variables: {
        id: category.id,
        input: { name: 'Alimentação', icon: 'UTENSILS' },
      },
    });

    expect(body.data?.updateCategory).toEqual({
      id: category.id,
      name: 'Alimentação',
      icon: 'UTENSILS',
    });
  });

  it('answers NOT_FOUND for another user category', async () => {
    const { token } = await signedIn();
    const { user: bruno } = await createUser();
    const brunos = await createCategory(bruno.id, { name: 'Mercado' });

    const body = await execute(app, {
      query: UPDATE_CATEGORY,
      token,
      variables: { id: brunos.id, input: { name: 'Sequestrada' } },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
    expect(
      (await prisma.category.findUnique({ where: { id: brunos.id } }))?.name,
    ).toBe('Mercado');
  });

  it('rejects an unauthenticated request', async () => {
    const body = await execute(app, {
      query: UPDATE_CATEGORY,
      variables: { id: 'any', input: { name: 'Mercado' } },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

describe('deleteCategory', () => {
  it('deletes the category and unlinks its transactions', async () => {
    const { user, token } = await signedIn();
    const category = await createCategory(user.id);
    const transaction = await createTransaction(user.id, {
      categoryId: category.id,
    });

    const body = await execute(app, {
      query: DELETE_CATEGORY,
      token,
      variables: { id: category.id },
    });

    expect(body.data?.deleteCategory).toBe(true);
    expect(
      (await prisma.transaction.findUnique({ where: { id: transaction.id } }))
        ?.categoryId,
    ).toBeNull();
  });

  it('answers NOT_FOUND for another user category', async () => {
    const { token } = await signedIn();
    const { user: bruno } = await createUser();
    const brunos = await createCategory(bruno.id);

    const body = await execute(app, {
      query: DELETE_CATEGORY,
      token,
      variables: { id: brunos.id },
    });

    expect(errorCode(body)).toBe('NOT_FOUND');
    expect(await prisma.category.count()).toBe(1);
  });

  it('rejects an unauthenticated request', async () => {
    const body = await execute(app, {
      query: DELETE_CATEGORY,
      variables: { id: 'any' },
    });

    expect(errorCode(body)).toBe('UNAUTHENTICATED');
  });
});

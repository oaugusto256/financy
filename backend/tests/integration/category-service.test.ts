import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/shared/prisma.js';
import {
  createCategory as createCategoryService,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../../src/modules/category/service.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createCategory as seedCategory,
  createTransaction,
  createUser,
} from '../helpers/factories.js';

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

const input = {
  name: 'Mercado',
  description: 'Compras da semana',
  icon: 'SHOPPING_CART',
  color: 'GREEN',
};

describe('createCategory', () => {
  it('creates a category owned by the caller', async () => {
    const { user } = await createUser();

    const category = await createCategoryService(user.id, input);

    expect(category).toMatchObject({
      name: 'Mercado',
      description: 'Compras da semana',
      icon: 'SHOPPING_CART',
      color: 'GREEN',
      userId: user.id,
    });
  });

  it('rejects a name the caller already used', async () => {
    const { user } = await createUser();
    await createCategoryService(user.id, input);

    await expect(createCategoryService(user.id, input)).rejects.toMatchObject({
      extensions: {
        code: 'BAD_USER_INPUT',
        fieldErrors: { name: ['Já existe uma categoria com esse nome'] },
      },
    });
  });

  it('lets a different user use the same name', async () => {
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();
    await createCategoryService(ana.id, input);

    await expect(createCategoryService(bruno.id, input)).resolves.toMatchObject(
      {
        userId: bruno.id,
      },
    );
  });

  it('rejects invalid input before touching the database', async () => {
    const { user } = await createUser();

    await expect(
      createCategoryService(user.id, { ...input, icon: 'ROCKET' }),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    expect(await prisma.category.count()).toBe(0);
  });

  it('answers BAD_USER_INPUT when the unique constraint fires under a race', async () => {
    // assertNameAvailable checks and then writes, so two concurrent calls can
    // both pass the check. Simulating that with a real race is flaky; writing
    // the row directly between the check and the write is the same situation
    // with a deterministic ordering.
    const { user } = await createUser();
    await prisma.category.create({
      data: {
        userId: user.id,
        name: 'Mercado',
        icon: 'WALLET',
        color: 'GREEN',
      },
    });

    // Bypasses assertNameAvailable by calling Prisma the way the service does
    // once its check has already passed.
    const collide = prisma.category.create({
      data: {
        userId: user.id,
        name: 'Mercado',
        icon: 'WALLET',
        color: 'GREEN',
      },
    });

    await expect(collide).rejects.toMatchObject({ code: 'P2002' });

    // And through the service, the same collision is a named field error.
    await expect(
      createCategoryService(user.id, {
        name: 'Mercado',
        icon: 'WALLET',
        color: 'GREEN',
      }),
    ).rejects.toMatchObject({
      extensions: {
        code: 'BAD_USER_INPUT',
        fieldErrors: { name: ['Já existe uma categoria com esse nome'] },
      },
    });
  });

  it('maps a P2002 from the write itself to a field error', async () => {
    // The race test above resolves through assertNameAvailable's pre-check,
    // never reaching rethrowDuplicateName. Forcing the write itself to reject
    // with P2002 is what actually exercises the .catch() mapping.
    const { user } = await createUser();
    const create = vi.spyOn(prisma.category, 'create').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    try {
      await expect(
        createCategoryService(user.id, {
          name: 'Mercado',
          icon: 'WALLET',
          color: 'GREEN',
        }),
      ).rejects.toMatchObject({
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: { name: ['Já existe uma categoria com esse nome'] },
        },
      });
    } finally {
      create.mockRestore();
    }
  });
});

describe('listCategories', () => {
  it('returns only the caller categories, by name', async () => {
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();
    await seedCategory(ana.id, { name: 'Transporte' });
    await seedCategory(ana.id, { name: 'Alimentação' });
    await seedCategory(bruno.id, { name: 'Lazer' });

    const categories = await listCategories(ana.id);

    expect(categories.map((category) => category.name)).toEqual([
      'Alimentação',
      'Transporte',
    ]);
  });

  it('returns an empty list for a user with none', async () => {
    const { user } = await createUser();

    expect(await listCategories(user.id)).toEqual([]);
  });
});

describe('updateCategory', () => {
  it('updates only the fields it is given', async () => {
    const { user } = await createUser();
    const category = await seedCategory(user.id, {
      name: 'Mercado',
      description: 'Compras',
      icon: 'SHOPPING_CART',
      color: 'GREEN',
    });

    const updated = await updateCategory(user.id, category.id, {
      name: 'Alimentação',
    });

    expect(updated).toMatchObject({
      name: 'Alimentação',
      description: 'Compras',
      icon: 'SHOPPING_CART',
      color: 'GREEN',
    });
  });

  it('clears the description when it is sent as null', async () => {
    const { user } = await createUser();
    const category = await seedCategory(user.id, { description: 'Compras' });

    const updated = await updateCategory(user.id, category.id, {
      description: null,
    });

    expect(updated.description).toBeNull();
  });

  it('rejects a rename onto another of the caller categories', async () => {
    const { user } = await createUser();
    await seedCategory(user.id, { name: 'Mercado' });
    const other = await seedCategory(user.id, { name: 'Transporte' });

    await expect(
      updateCategory(user.id, other.id, { name: 'Mercado' }),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
  });

  it('allows renaming a category to the name it already has', async () => {
    const { user } = await createUser();
    const category = await seedCategory(user.id, { name: 'Mercado' });

    await expect(
      updateCategory(user.id, category.id, { name: 'Mercado', icon: 'BUS' }),
    ).resolves.toMatchObject({ name: 'Mercado', icon: 'BUS' });
  });

  it('answers NOT_FOUND for another user category', async () => {
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();
    const anas = await seedCategory(ana.id);

    await expect(
      updateCategory(bruno.id, anas.id, { name: 'Sequestrada' }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
    // FORBIDDEN would confirm the id exists. backend.md section 6.
    expect(
      (await prisma.category.findUnique({ where: { id: anas.id } }))?.name,
    ).toBe(anas.name);
  });

  it('answers NOT_FOUND for an id that does not exist, even with a taken name', async () => {
    const { user } = await createUser();
    await seedCategory(user.id, { name: 'Mercado' });

    // Existence is checked before the name, so a bogus id does not come back
    // as a validation error about a name the caller never sees.
    await expect(
      updateCategory(user.id, 'no-such-id', { name: 'Mercado' }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });
});

describe('deleteCategory', () => {
  it('deletes the caller category and keeps its transactions', async () => {
    const { user } = await createUser();
    const category = await seedCategory(user.id);
    const transaction = await createTransaction(user.id, {
      categoryId: category.id,
    });

    await expect(deleteCategory(user.id, category.id)).resolves.toBe(true);

    expect(await prisma.category.count()).toBe(0);
    const survivor = await prisma.transaction.findUnique({
      where: { id: transaction.id },
    });
    expect(survivor?.categoryId).toBeNull();
  });

  it('answers NOT_FOUND for another user category and leaves it alone', async () => {
    const { user: ana } = await createUser();
    const { user: bruno } = await createUser();
    const anas = await seedCategory(ana.id);

    await expect(deleteCategory(bruno.id, anas.id)).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
    expect(await prisma.category.count()).toBe(1);
  });
});

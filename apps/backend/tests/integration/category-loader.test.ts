import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/shared/prisma.js';
import { createLoaders } from '../../src/shared/dataloaders.js';
import { resetDatabase } from '../helpers/db.js';
import { createCategory, createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);

describe('categoryById', () => {
  it('maps each key to its own category', async () => {
    const { user } = await createUser();
    const first = await createCategory(user.id, { name: 'Casa' });
    const second = await createCategory(user.id, { name: 'Transporte' });

    const loaders = createLoaders(user.id);
    const [a, b] = await Promise.all([
      loaders.categoryById.load(first.id),
      loaders.categoryById.load(second.id),
    ]);

    expect(a?.name).toBe('Casa');
    expect(b?.name).toBe('Transporte');
  });

  it('maps a mixed batch of present, missing and foreign keys to their own positions', async () => {
    // The teeth this test needs: a single batch mixing hits and misses, keys
    // requested in an order that diverges from creation order. A batch
    // function that returned Prisma's rows positionally instead of remapping
    // through an id -> row lookup would pass every other test in this file
    // (each of them either loads keys in creation order or loads one key at a
    // time) but would mismatch keys to values here.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const first = await createCategory(owner.id, { name: 'Casa' });
    const second = await createCategory(owner.id, { name: 'Transporte' });
    const foreign = await createCategory(other.id, { name: 'Deles' });

    const loaders = createLoaders(owner.id);

    const [missing, secondResult, foreignResult, firstResult] =
      await Promise.all([
        loaders.categoryById.load('does-not-exist'),
        loaders.categoryById.load(second.id),
        loaders.categoryById.load(foreign.id),
        loaders.categoryById.load(first.id),
      ]);

    expect(missing).toBeNull();
    expect(secondResult?.name).toBe('Transporte');
    expect(foreignResult).toBeNull();
    expect(firstResult?.name).toBe('Casa');
  });

  it('issues one query for a batch of keys', async () => {
    const { user } = await createUser();
    const categories = await Promise.all([
      createCategory(user.id, { name: 'A' }),
      createCategory(user.id, { name: 'B' }),
      createCategory(user.id, { name: 'C' }),
    ]);

    // Spying on findMany rather than listening for query events: this client is
    // not built with log: ['query'], and the spy proves the property the loader
    // exists for — one call, three keys.
    const spy = vi.spyOn(prisma.category, 'findMany');
    const loaders = createLoaders(user.id);

    await Promise.all(
      categories.map((category) => loaders.categoryById.load(category.id)),
    );

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('yields null for another user’s category', async () => {
    // The batch query is scoped by userId, so a key outside the caller's scope
    // resolves to null rather than to somebody else's row.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    const theirs = await createCategory(other.id, { name: 'Deles' });

    const loaders = createLoaders(owner.id);

    expect(await loaders.categoryById.load(theirs.id)).toBeNull();
  });

  it('yields null for a key that matches nothing', async () => {
    const { user } = await createUser();
    const loaders = createLoaders(user.id);

    expect(await loaders.categoryById.load('does-not-exist')).toBeNull();
  });

  it('yields null for every key when there is no user', async () => {
    const { user } = await createUser();
    const category = await createCategory(user.id);
    const loaders = createLoaders(null);

    expect(await loaders.categoryById.load(category.id)).toBeNull();
  });
});

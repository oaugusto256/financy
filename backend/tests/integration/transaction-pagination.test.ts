import { beforeEach, describe, expect, it } from 'vitest';
import { listTransactions } from '../../src/modules/transaction/service.js';
import { resetDatabase } from '../helpers/db.js';
import { createTransaction, createUser } from '../helpers/factories.js';

beforeEach(resetDatabase);

/** Creates `count` transactions, one per day, oldest first. */
async function seedDays(userId: string, count: number) {
  for (let day = 1; day <= count; day += 1) {
    await createTransaction(userId, {
      description: `Dia ${day}`,
      date: new Date(Date.UTC(2026, 6, day, 12, 0, 0)),
    });
  }
}

describe('listTransactions', () => {
  it('returns ten rows by default with the full count beside them', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 27);

    const page = await listTransactions(user.id, {});

    expect(page.items).toHaveLength(10);
    // The count is of the whole result set, not of the page — the footer reads
    // "1 a 10 | 27 resultados".
    expect(page.totalCount).toBe(27);
  });

  it('orders by date descending', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 3);

    const page = await listTransactions(user.id, {});

    expect(page.items.map((item) => item.description)).toEqual([
      'Dia 3',
      'Dia 2',
      'Dia 1',
    ]);
  });

  it('breaks a tie on date by createdAt descending, so a row cannot straddle two pages', async () => {
    const { user } = await createUser();
    const sameDay = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));

    const first = await createTransaction(user.id, {
      description: 'Primeira',
      date: sameDay,
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await createTransaction(user.id, {
      description: 'Segunda',
      date: sameDay,
    });
    expect(second.createdAt.getTime()).toBeGreaterThanOrEqual(
      first.createdAt.getTime(),
    );

    const pageOne = await listTransactions(user.id, { limit: 1, offset: 0 });
    const pageTwo = await listTransactions(user.id, { limit: 1, offset: 1 });

    expect(pageOne.items[0]?.description).toBe('Segunda');
    expect(pageTwo.items[0]?.description).toBe('Primeira');
  });

  it('windows with offset', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 27);

    const third = await listTransactions(user.id, { limit: 10, offset: 20 });

    expect(third.items).toHaveLength(7);
    expect(third.totalCount).toBe(27);
    expect(third.items[0]?.description).toBe('Dia 7');
  });

  it('returns an empty page past the end rather than erroring', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 3);

    const page = await listTransactions(user.id, { limit: 10, offset: 100 });

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(3);
  });

  it('clamps a limit above the maximum', async () => {
    const { user } = await createUser();
    await seedDays(user.id, 101);

    expect(
      (await listTransactions(user.id, { limit: 500 })).items,
    ).toHaveLength(100);
  });

  it('never returns another user’s rows', async () => {
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    await seedDays(owner.id, 2);
    await seedDays(other.id, 5);

    const page = await listTransactions(owner.id, {});

    expect(page.items).toHaveLength(2);
    expect(page.totalCount).toBe(2);
    expect(page.items.every((item) => item.userId === owner.id)).toBe(true);
  });

  it('counts only the caller’s rows even when the page is full', async () => {
    // totalCount comes from its own query. Scoping findMany but not count is a
    // way to leak how much data another user has without showing any of it.
    const { user: owner } = await createUser();
    const { user: other } = await createUser();
    await seedDays(owner.id, 12);
    await seedDays(other.id, 40);

    expect((await listTransactions(owner.id, {})).totalCount).toBe(12);
  });

  it('surfaces a bad argument as BAD_USER_INPUT', async () => {
    const { user } = await createUser();

    await expect(
      listTransactions(user.id, { offset: -1 }),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
  });

  it('rejects a limit below one as BAD_USER_INPUT', async () => {
    // The asymmetric bound: below 1 rejects, above MAX_LIMIT clamps. Pinned
    // through listTransactions itself, not just at the schema, since the
    // point is that the service surfaces the schema's rejection as
    // BAD_USER_INPUT rather than letting a bare ZodError escape.
    const { user } = await createUser();

    await expect(listTransactions(user.id, { limit: 0 })).rejects.toMatchObject(
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  });
});

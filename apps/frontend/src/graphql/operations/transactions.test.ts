import { describe, expect, it } from 'vitest';
import { useTransactionsQuery } from '@/graphql/generated/graphql';

describe('the generated transactions query key', () => {
  it('starts with the literal DeleteCategoryDialog already invalidates', () => {
    // Slice 2 shipped queryClient.invalidateQueries({ queryKey: ['Transactions'] })
    // with no consumer, betting on this name. TanStack matches by prefix, so
    // the bare literal has to be the first element or that invalidation is a
    // silent no-op and a deleted category leaves stale tags on every row.
    expect(useTransactionsQuery.getKey({ limit: 10, offset: 0 })[0]).toBe(
      'Transactions',
    );
  });

  it('separates one page from another', () => {
    expect(useTransactionsQuery.getKey({ limit: 10, offset: 0 })).not.toEqual(
      useTransactionsQuery.getKey({ limit: 10, offset: 10 }),
    );
  });

  it('still starts with the bare literal when a filter is present', () => {
    // Both dialogs invalidate the bare ['Transactions'] and TanStack matches
    // by prefix. A filtered page whose key did not start with that literal
    // would keep showing a row the user just deleted.
    expect(
      useTransactionsQuery.getKey({
        filter: { search: 'mercado' },
        limit: 10,
        offset: 0,
      })[0],
    ).toBe('Transactions');
  });

  it('separates one filter from another', () => {
    // Two filters sharing a cache entry is a stale table: switch the type
    // select and the previous type's rows are served from cache.
    expect(
      useTransactionsQuery.getKey({
        filter: { type: 'INCOME' },
        limit: 10,
        offset: 0,
      }),
    ).not.toEqual(
      useTransactionsQuery.getKey({
        filter: { type: 'EXPENSE' },
        limit: 10,
        offset: 0,
      }),
    );
  });
});

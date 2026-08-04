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
});

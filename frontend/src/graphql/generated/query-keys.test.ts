import { describe, expect, it } from 'vitest';
import { useMeQuery, useSummaryQuery } from './graphql';

describe('generated query keys', () => {
  it('keys the me query on its operation name', () => {
    expect(useMeQuery.getKey()).toEqual(['Me']);
  });
});

describe('the summary query key', () => {
  // TransactionDialog.tsx and DeleteTransactionDialog.tsx both invalidate the
  // bare literal ['Summary']. TanStack matches by prefix, so this is the test
  // that proves those two calls reach the dashboard's cache entry instead of
  // being the silent no-ops slices 3 and 4 both recorded.
  it('keys on the operation name and its variables', () => {
    expect(useSummaryQuery.getKey({ month: 8, year: 2026 })).toEqual([
      'Summary',
      { month: 8, year: 2026 },
    ]);
  });

  it('starts with the literal the mutation dialogs invalidate', () => {
    expect(useSummaryQuery.getKey({ month: 1, year: 2026 })[0]).toBe('Summary');
  });
});

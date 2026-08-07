import { describe, expect, it } from 'vitest';
import { transactionFormSchema } from './validation';

const valid = {
  description: 'Compras da semana',
  amount: 1_234,
  type: 'EXPENSE' as const,
  date: '2026-08-04',
  categoryId: 'category-1',
};

describe('transactionFormSchema', () => {
  it('accepts a complete transaction', () => {
    expect(transactionFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a zero amount', () => {
    const result = transactionFormSchema.safeParse({ ...valid, amount: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Informe um valor maior que zero',
    );
  });

  it('rejects a negative amount', () => {
    // The mask can never type a sign, but the schema is the client-side
    // mirror of backend.md section 7: the owner ruled negative amounts are
    // rejected outright, not just zero, so the two schemas must agree even
    // though the UI cannot exercise this path directly.
    const result = transactionFormSchema.safeParse({ ...valid, amount: -500 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Informe um valor maior que zero',
    );
  });
});

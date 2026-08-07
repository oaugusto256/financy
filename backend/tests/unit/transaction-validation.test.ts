import { describe, expect, it } from 'vitest';
import { parseInput } from '../../src/shared/validation.js';
import {
  createTransactionSchema,
  transactionFilterSchema,
  transactionPageSchema,
  updateTransactionSchema,
} from '../../src/modules/transaction/validation.js';

const valid = {
  description: 'Mercado do mês',
  amount: 12_345,
  type: 'EXPENSE',
  date: new Date('2026-08-04T03:00:00.000Z'),
  categoryId: 'category-1',
};

describe('createTransactionSchema', () => {
  it('accepts a complete transaction', () => {
    expect(parseInput(createTransactionSchema, valid)).toEqual(valid);
  });

  it('trims the description', () => {
    const parsed = parseInput(createTransactionSchema, {
      ...valid,
      description: '  Mercado do mês  ',
    });

    expect(parsed.description).toBe('Mercado do mês');
  });

  it('rejects a description that is only whitespace', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, description: '   ' }),
    ).toThrow('A descrição é obrigatória');
  });

  it('rejects a description longer than 200 characters', () => {
    expect(() =>
      parseInput(createTransactionSchema, {
        ...valid,
        description: 'a'.repeat(201),
      }),
    ).toThrow('A descrição deve ter no máximo 200 caracteres');
  });

  it('rejects an amount that is not an integer', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, amount: 12.5 }),
    ).toThrow('O valor deve ser um número inteiro de centavos');
  });

  it('rejects a zero amount', () => {
    // The sign is not used — `type` carries the direction — so zero is the only
    // amount with no meaning. backend.md section 7.
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, amount: 0 }),
    ).toThrow('O valor deve ser maior que zero');
  });

  it('rejects a negative amount', () => {
    // A stored negative silently falsifies Category.totalAmount (an unsigned
    // sum) and totalBalance (a signed sum keyed by `type`). backend.md
    // section 7 — the owner ruled negatives are rejected, not merely unused.
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, amount: -500 }),
    ).toThrow('O valor deve ser maior que zero');
  });

  it('rejects a null description with a Portuguese message', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, description: null }),
    ).toThrow('A descrição é obrigatória');
  });

  it('rejects a type outside the two tokens', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, type: 'TRANSFER' }),
    ).toThrow('Selecione um tipo válido');
  });

  it('rejects a date it cannot parse', () => {
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, date: 'ontem' }),
    ).toThrow('Informe uma data válida');
  });

  it('rejects a null date instead of writing the epoch', () => {
    // z.coerce.date() alone treats null as new Date(null), which is the
    // valid Date 1970-01-01 — not an invalid one. A well-formed
    // `{ date: null }` GraphQL input must not silently write the epoch.
    expect(() =>
      parseInput(createTransactionSchema, { ...valid, date: null }),
    ).toThrow('Informe uma data válida');
  });

  it('accepts an ISO string for the date and yields a Date', () => {
    // The resolver hands over whatever the DateTime scalar produced, and the
    // service is also called directly from tests with a string.
    const parsed = parseInput(createTransactionSchema, {
      ...valid,
      date: '2026-08-04T03:00:00.000Z',
    });

    expect(parsed.date).toBeInstanceOf(Date);
    expect(parsed.date.toISOString()).toBe('2026-08-04T03:00:00.000Z');
  });

  it('turns an omitted, empty or null categoryId into null', () => {
    const { categoryId, ...withoutCategory } = valid;
    expect(categoryId).toBe('category-1');

    expect(
      parseInput(createTransactionSchema, withoutCategory).categoryId,
    ).toBeNull();
    expect(
      parseInput(createTransactionSchema, { ...valid, categoryId: '' })
        .categoryId,
    ).toBeNull();
    expect(
      parseInput(createTransactionSchema, { ...valid, categoryId: null })
        .categoryId,
    ).toBeNull();
  });

  it('names the failing field so the frontend can render it inline', () => {
    try {
      parseInput(createTransactionSchema, { ...valid, description: '' });
      throw new Error('should have thrown');
    } catch (error) {
      const extensions = (
        error as { extensions?: { fieldErrors?: Record<string, string[]> } }
      ).extensions;
      expect(extensions?.fieldErrors?.description).toContain(
        'A descrição é obrigatória',
      );
    }
  });

  it('trims the description', () => {
    // Untested through slice 3: .trim() could have been dropped from the
    // shared `description` schema and nothing would have failed.
    expect(
      createTransactionSchema.parse({
        description: '  Mercado  ',
        amount: 1000,
        type: 'EXPENSE',
        date: '2026-08-01T12:00:00.000Z',
      }).description,
    ).toBe('Mercado');
  });
});

describe('updateTransactionSchema', () => {
  it('accepts a partial update', () => {
    expect(parseInput(updateTransactionSchema, { amount: 500 })).toEqual({
      amount: 500,
    });
  });

  it('accepts an empty object as a no-op', () => {
    expect(parseInput(updateTransactionSchema, {})).toEqual({});
  });

  it('distinguishes an absent categoryId from an explicit null', () => {
    // Absent means "leave the category alone", null means "make it
    // uncategorized". Collapsing the two would unlink a transaction on every
    // description edit.
    expect(
      parseInput(updateTransactionSchema, { amount: 500 }).categoryId,
    ).toBeUndefined();
    expect(parseInput(updateTransactionSchema, { categoryId: null })).toEqual({
      categoryId: null,
    });
    expect(parseInput(updateTransactionSchema, { categoryId: '' })).toEqual({
      categoryId: null,
    });
  });

  it('applies the same limits as creation', () => {
    expect(() => parseInput(updateTransactionSchema, { amount: 0 })).toThrow(
      'O valor deve ser maior que zero',
    );
    expect(() =>
      parseInput(updateTransactionSchema, { description: 'a'.repeat(201) }),
    ).toThrow('A descrição deve ter no máximo 200 caracteres');
  });

  it('rejects a negative amount', () => {
    expect(() => parseInput(updateTransactionSchema, { amount: -500 })).toThrow(
      'O valor deve ser maior que zero',
    );
  });

  it('rejects a null description with a Portuguese message', () => {
    expect(() =>
      parseInput(updateTransactionSchema, { description: null }),
    ).toThrow('A descrição é obrigatória');
  });

  it('accepts both transaction types unchanged', () => {
    // The suite otherwise never asserts 'INCOME' is accepted anywhere — a typo
    // in the second token of TRANSACTION_TYPES would go uncaught.
    expect(parseInput(updateTransactionSchema, { type: 'INCOME' })).toEqual({
      type: 'INCOME',
    });
    expect(parseInput(updateTransactionSchema, { type: 'EXPENSE' })).toEqual({
      type: 'EXPENSE',
    });
  });

  it('rejects a type outside the two tokens', () => {
    expect(() =>
      parseInput(updateTransactionSchema, { type: 'TRANSFER' }),
    ).toThrow('Selecione um tipo válido');
  });

  it('accepts a date and yields a Date', () => {
    const parsed = parseInput(updateTransactionSchema, {
      date: '2026-08-04T03:00:00.000Z',
    });

    expect(parsed.date).toBeInstanceOf(Date);
    expect(parsed.date?.toISOString()).toBe('2026-08-04T03:00:00.000Z');
  });

  it('rejects a date it cannot parse', () => {
    expect(() =>
      parseInput(updateTransactionSchema, { date: 'ontem' }),
    ).toThrow('Informe uma data válida');
  });

  it('rejects a null date instead of writing the epoch', () => {
    expect(() => parseInput(updateTransactionSchema, { date: null })).toThrow(
      'Informe uma data válida',
    );
  });

  it('trims the description and keeps a real categoryId untouched', () => {
    const parsed = updateTransactionSchema.parse({
      description: '  Luz  ',
      categoryId: 'category-1',
    });

    expect(parsed.description).toBe('Luz');
    expect(parsed.categoryId).toBe('category-1');
  });
});

describe('transactionPageSchema', () => {
  it('defaults to ten rows from the start', () => {
    expect(parseInput(transactionPageSchema, {})).toEqual({
      filter: {},
      limit: 10,
      offset: 0,
    });
  });

  it('passes a limit within range through untouched', () => {
    expect(
      parseInput(transactionPageSchema, { limit: 25, offset: 50 }),
    ).toEqual({ filter: {}, limit: 25, offset: 50 });
  });

  it('clamps a limit above the maximum instead of erroring', () => {
    // backend.md section 5: the maximum holds "regardless of what the client
    // sends". A client asking for 500 rows wants as many as it can have.
    expect(parseInput(transactionPageSchema, { limit: 500 }).limit).toBe(100);
  });

  it('rejects a limit below one', () => {
    expect(() => parseInput(transactionPageSchema, { limit: 0 })).toThrow(
      'O limite deve ser pelo menos 1',
    );
  });

  it('rejects a negative offset', () => {
    expect(() => parseInput(transactionPageSchema, { offset: -1 })).toThrow(
      'O deslocamento não pode ser negativo',
    );
  });

  it('rejects a non-integer limit or offset', () => {
    expect(() => parseInput(transactionPageSchema, { limit: 1.5 })).toThrow(
      'O limite deve ser um número inteiro',
    );
    expect(() => parseInput(transactionPageSchema, { offset: 2.5 })).toThrow(
      'O deslocamento deve ser um número inteiro',
    );
  });

  it('treats null the way GraphQL sends an omitted nullable argument', () => {
    expect(
      parseInput(transactionPageSchema, { limit: null, offset: null }),
    ).toEqual({ filter: {}, limit: 10, offset: 0 });
  });
});

describe('transactionFilterSchema', () => {
  it('accepts every field the SDL offers', () => {
    const filter = transactionFilterSchema.parse({
      search: 'mercado',
      type: 'EXPENSE',
      categoryId: 'category-1',
      dateFrom: '2026-08-01T00:00:00.000Z',
      dateTo: '2026-08-31T23:59:59.999Z',
    });

    expect(filter.search).toBe('mercado');
    expect(filter.type).toBe('EXPENSE');
    expect(filter.categoryId).toBe('category-1');
    expect(filter.dateFrom).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    expect(filter.dateTo).toEqual(new Date('2026-08-31T23:59:59.999Z'));
  });

  it('treats an empty or blank search as no search at all', () => {
    // The bar clears its input to '' rather than removing the param mid-edit.
    // Left as an empty string this becomes `contains: ''`, which is a LIKE
    // '%%' — harmless today, but it also makes the "is anything filtered"
    // question un-answerable from the parsed object.
    expect(
      transactionFilterSchema.parse({ search: '' }).search,
    ).toBeUndefined();
    expect(
      transactionFilterSchema.parse({ search: '   ' }).search,
    ).toBeUndefined();
  });

  it('trims a search term', () => {
    expect(transactionFilterSchema.parse({ search: '  luz  ' }).search).toBe(
      'luz',
    );
  });

  it('rejects a search longer than 100 characters', () => {
    // backend.md section 7.
    const result = transactionFilterSchema.safeParse({
      search: 'a'.repeat(101),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'A busca deve ter no máximo 100 caracteres',
    );
  });

  it('accepts exactly 100 characters', () => {
    expect(
      transactionFilterSchema.safeParse({ search: 'a'.repeat(100) }).success,
    ).toBe(true);
  });

  it('treats an empty category as no category filter', () => {
    expect(
      transactionFilterSchema.parse({ categoryId: '' }).categoryId,
    ).toBeUndefined();
    expect(
      transactionFilterSchema.parse({ categoryId: null }).categoryId,
    ).toBeUndefined();
  });

  it('rejects a type outside the enum', () => {
    expect(
      transactionFilterSchema.safeParse({ type: 'TRANSFER' }).success,
    ).toBe(false);
  });

  it('rejects a null date bound rather than reading it as the epoch', () => {
    // The same trap slice 3's review found on `date`: new Date(null) is
    // 1970-01-01, a valid Date. A null bound must mean "no bound", never
    // "since the epoch" — which would silently exclude nothing on dateFrom
    // and everything on dateTo.
    expect(transactionFilterSchema.parse({ dateFrom: null }).dateFrom).toBe(
      undefined,
    );
    expect(transactionFilterSchema.parse({ dateTo: null }).dateTo).toBe(
      undefined,
    );
  });

  it('rejects a date bound that is not date-shaped', () => {
    const result = transactionFilterSchema.safeParse({ dateFrom: 42 });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Informe uma data válida');
  });

  it('parses an absent filter to an empty object, not undefined', () => {
    // The service destructures it. `undefined` there is a crash on the first
    // unfiltered request, which is every request the app makes today.
    expect(transactionPageSchema.parse({}).filter).toEqual({});
    expect(transactionPageSchema.parse({ filter: null }).filter).toEqual({});
  });

  it('carries the filter through beside the pagination bounds', () => {
    const args = transactionPageSchema.parse({
      filter: { type: 'INCOME' },
      limit: 500,
      offset: 20,
    });

    expect(args.filter.type).toBe('INCOME');
    // The clamp still applies with a filter present.
    expect(args.limit).toBe(100);
    expect(args.offset).toBe(20);
  });
});

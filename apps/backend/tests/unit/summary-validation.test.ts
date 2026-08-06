import { describe, expect, it } from 'vitest';
import { parseInput } from '../../src/shared/validation.js';
import { summaryArgsSchema } from '../../src/modules/summary/validation.js';

describe('summaryArgsSchema', () => {
  it('accepts a month and year in range', () => {
    expect(parseInput(summaryArgsSchema, { month: 8, year: 2026 })).toEqual({
      month: 8,
      year: 2026,
    });
  });

  it('accepts both month bounds', () => {
    expect(parseInput(summaryArgsSchema, { month: 1, year: 2026 }).month).toBe(
      1,
    );
    expect(parseInput(summaryArgsSchema, { month: 12, year: 2026 }).month).toBe(
      12,
    );
  });

  it('rejects a month one past either bound', () => {
    expect(() =>
      parseInput(summaryArgsSchema, { month: 0, year: 2026 }),
    ).toThrow('O mês deve estar entre 1 e 12');
    expect(() =>
      parseInput(summaryArgsSchema, { month: 13, year: 2026 }),
    ).toThrow('O mês deve estar entre 1 e 12');
  });

  it('rejects a non-integer month', () => {
    // A fractional month reaching Date.UTC produces a window nobody asked for
    // rather than an error.
    expect(() =>
      parseInput(summaryArgsSchema, { month: 8.5, year: 2026 }),
    ).toThrow('O mês deve ser um número inteiro');
  });

  it('accepts both year bounds', () => {
    expect(parseInput(summaryArgsSchema, { month: 1, year: 1970 }).year).toBe(
      1970,
    );
    expect(parseInput(summaryArgsSchema, { month: 1, year: 9999 }).year).toBe(
      9999,
    );
  });

  it('rejects a year one past either bound', () => {
    expect(() =>
      parseInput(summaryArgsSchema, { month: 1, year: 1969 }),
    ).toThrow('O ano deve estar entre 1970 e 9999');
    expect(() =>
      parseInput(summaryArgsSchema, { month: 1, year: 10_000 }),
    ).toThrow('O ano deve estar entre 1970 e 9999');
  });

  it('rejects a non-integer year', () => {
    expect(() =>
      parseInput(summaryArgsSchema, { month: 1, year: 2026.5 }),
    ).toThrow('O ano deve ser um número inteiro');
  });

  it('names the failing field so the client can point at it', () => {
    try {
      parseInput(summaryArgsSchema, { month: 13, year: 2026 });
      throw new Error('should have thrown');
    } catch (error) {
      const extensions = (
        error as { extensions?: { fieldErrors?: Record<string, string[]> } }
      ).extensions;
      expect(extensions?.fieldErrors?.month).toContain(
        'O mês deve estar entre 1 e 12',
      );
    }
  });
});

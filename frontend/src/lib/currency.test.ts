import { describe, expect, it } from 'vitest';
import {
  MAX_CENTS,
  centsToDisplay,
  digitsToCents,
  formatSignedAmount,
} from '@/lib/currency';

describe('centsToDisplay', () => {
  it('renders whole reais', () => {
    expect(centsToDisplay(0)).toBe('R$ 0,00');
    expect(centsToDisplay(100)).toBe('R$ 1,00');
  });

  it('renders sub-real amounts with two digits', () => {
    expect(centsToDisplay(1)).toBe('R$ 0,01');
    expect(centsToDisplay(12)).toBe('R$ 0,12');
  });

  it('renders the value that floating point gets wrong', () => {
    // 1999 / 100 is not exactly 19.99 in binary floating point. This function
    // never divides, so there is nothing to round.
    expect(centsToDisplay(1_999)).toBe('R$ 19,99');
  });

  it('groups thousands the Brazilian way', () => {
    expect(centsToDisplay(150_000)).toBe('R$ 1.500,00');
    expect(centsToDisplay(123_456_789)).toBe('R$ 1.234.567,89');
  });

  it('renders the largest value the schema accepts', () => {
    // GraphQL Int is 32-bit signed.
    expect(centsToDisplay(MAX_CENTS)).toBe('R$ 21.474.836,47');
  });
});

describe('digitsToCents', () => {
  it('reads an empty field as zero', () => {
    expect(digitsToCents('')).toBe(0);
    expect(digitsToCents('R$ ,')).toBe(0);
  });

  it('fills from the right, one digit at a time', () => {
    expect(digitsToCents('1')).toBe(1);
    expect(digitsToCents('12')).toBe(12);
    expect(digitsToCents('123')).toBe(123);
    expect(digitsToCents('1234')).toBe(1_234);
  });

  it('ignores everything that is not a digit', () => {
    expect(digitsToCents('R$ 12,34')).toBe(1_234);
    expect(digitsToCents('R$ 1.234,56')).toBe(123_456);
    expect(digitsToCents('abc')).toBe(0);
  });

  it('clamps at the largest value the schema accepts', () => {
    // Better than sending a number the server answers with a GraphQL type
    // error the form has no field to attach.
    expect(digitsToCents('999999999999')).toBe(MAX_CENTS);
  });

  it('drops a leading zero rather than accumulating one', () => {
    expect(digitsToCents('0012')).toBe(12);
  });
});

describe('the pair round-trips', () => {
  it('returns the same integer it was given', () => {
    for (const cents of [
      0,
      1,
      12,
      99,
      100,
      1_999,
      150_000,
      123_456_789,
      MAX_CENTS,
    ]) {
      expect(digitsToCents(centsToDisplay(cents))).toBe(cents);
    }
  });
});

describe('formatSignedAmount', () => {
  it('signs an expense negative and income positive', () => {
    // The stored amount is unsigned — `type` carries the direction.
    expect(formatSignedAmount(1_234, 'EXPENSE')).toBe('-R$ 12,34');
    expect(formatSignedAmount(1_234, 'INCOME')).toBe('+R$ 12,34');
  });
});

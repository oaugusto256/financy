import { describe, expect, it } from 'vitest';
import { monthsBack } from '../../prisma/seed-dates.js';

describe('monthsBack', () => {
  it('returns local midnight on the requested day of the current month', () => {
    const date = monthsBack(0, 5, new Date(2026, 7, 20, 14, 30));

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(5);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it('walks back within the same year', () => {
    const date = monthsBack(3, 12, new Date(2026, 7, 20));

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(12);
  });

  it('rolls into the previous year', () => {
    // The case that breaks silently: eleven months back from February is March
    // of the year before, not month -9 of the same one.
    const date = monthsBack(11, 3, new Date(2026, 1, 20));

    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(3);
  });

  it('reaches eleven distinct months back from January without repeating one', () => {
    const now = new Date(2027, 0, 15);
    const months = Array.from({ length: 12 }, (_, index) =>
      monthsBack(index, 10, now),
    ).map((date) => `${date.getFullYear()}-${date.getMonth()}`);

    expect(new Set(months).size).toBe(12);
    expect(months.at(-1)).toBe('2026-1');
  });

  it('keeps a day 28 inside February', () => {
    const date = monthsBack(0, 28, new Date(2027, 1, 15));

    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(28);
  });
});

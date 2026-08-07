import { describe, expect, it } from 'vitest';
import {
  ALL_PERIODS,
  currentPeriod,
  periodOptions,
  periodRange,
} from '@/lib/period';

// TZ is pinned to America/Sao_Paulo (UTC−3, no DST) by the test script and by
// vite.config.ts. Every instant below is written against that offset.
const AUGUST_2026 = new Date(2026, 7, 6, 12, 0, 0);

describe('periodOptions', () => {
  it('offers the current month, the eleven before it, and "all"', () => {
    const options = periodOptions(AUGUST_2026);

    expect(options).toHaveLength(13);
    expect(options[0]).toEqual({
      value: ALL_PERIODS,
      label: 'Todos os períodos',
    });
    expect(options[1]?.value).toBe('2026-08');
    expect(options[12]?.value).toBe('2025-09');
  });

  it('labels a month in Portuguese, capitalised', () => {
    const options = periodOptions(AUGUST_2026);

    expect(options[1]?.label).toBe('Agosto de 2026');
    expect(options[12]?.label).toBe('Setembro de 2025');
  });

  it('crosses the year boundary without repeating a month', () => {
    const values = periodOptions(new Date(2026, 0, 15, 12, 0, 0))
      .slice(1)
      .map((option) => option.value);

    expect(values[0]).toBe('2026-01');
    expect(values[1]).toBe('2025-12');
    expect(new Set(values).size).toBe(12);
  });

  it('is stable on the 31st', () => {
    // subMonths(new Date(2026, 6, 31), 1) is June 30 — a naive
    // setMonth(month - 1) would give July 1 and produce two July entries.
    const values = periodOptions(new Date(2026, 6, 31, 12, 0, 0))
      .slice(1)
      .map((option) => option.value);

    expect(values.slice(0, 3)).toEqual(['2026-07', '2026-06', '2026-05']);
  });
});

describe('periodRange', () => {
  it('spans a whole local month, both ends inclusive', () => {
    expect(periodRange('2026-08')).toEqual({
      // Local midnight on August 1 is 03:00Z; the last millisecond of
      // August 31 is 02:59:59.999Z on September 1.
      dateFrom: '2026-08-01T03:00:00.000Z',
      dateTo: '2026-09-01T02:59:59.999Z',
    });
  });

  it('handles February in a leap year', () => {
    expect(periodRange('2028-02')?.dateTo).toBe('2028-03-01T02:59:59.999Z');
  });

  it('is undefined for "all periods"', () => {
    // The absence of a range is what makes the unfiltered page the default.
    expect(periodRange(ALL_PERIODS)).toBeUndefined();
  });

  it('is undefined for a hand-typed value that is not a month', () => {
    // ?period=banana is a URL a user can type. It must not become a range of
    // NaN, which Prisma would receive as an invalid date.
    expect(periodRange('banana')).toBeUndefined();
    expect(periodRange('2026-13')).toBeUndefined();
  });

  it('is undefined for a right-shaped but unpadded value', () => {
    // date-fns' `parse` is lenient about padding on its own — '2026-8' and
    // '26-08' both parse to a valid date — but `periodOptions()` never emits
    // either shape, only the zero-padded, four-digit-year form. Accepting
    // them here would leave a value no <option> matches, desyncing the
    // select from the URL.
    expect(periodRange('2026-8')).toBeUndefined();
    expect(periodRange('26-08')).toBeUndefined();
  });

  it('round-trips every value periodOptions() actually emits', () => {
    // The property the shape guard must not break: every real value the
    // select offers still produces a range.
    const values = periodOptions(AUGUST_2026)
      .slice(1)
      .map((option) => option.value);

    expect(values).toHaveLength(12);
    for (const value of values) {
      expect(periodRange(value)).not.toBeUndefined();
    }
  });
});

describe('currentPeriod', () => {
  // `now` is a parameter for the same reason periodOptions takes one: the
  // tests must not be written against the wall clock.
  it('reads the month as 1-12, not as the zero-based index', () => {
    expect(currentPeriod(new Date(2026, 7, 15))).toEqual({
      month: 8,
      year: 2026,
    });
  });

  it('reports December as 12 and January as 1', () => {
    expect(currentPeriod(new Date(2026, 11, 31))).toEqual({
      month: 12,
      year: 2026,
    });
    expect(currentPeriod(new Date(2027, 0, 1))).toEqual({
      month: 1,
      year: 2027,
    });
  });

  it('reads the browser’s local time, which is what the cards ask for', () => {
    // TZ is pinned to America/Sao_Paulo, so this instant is 31 December
    // locally and 1 January in UTC. The dashboard asks for the local month;
    // the server windows it in UTC. frontend.md section 12 records the gap.
    expect(currentPeriod(new Date('2027-01-01T02:00:00.000Z'))).toEqual({
      month: 12,
      year: 2026,
    });
  });
});

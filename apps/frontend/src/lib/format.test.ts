import { describe, expect, it } from 'vitest';
import {
  formatShortDate,
  fromDateInputValue,
  toDateInputValue,
} from '@/lib/format';

describe('the test timezone is pinned', () => {
  it('runs in America/Sao_Paulo', () => {
    // Every assertion below depends on it. A failure here means the TZ was not
    // set on the test script, not that the formatters are wrong.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      'America/Sao_Paulo',
    );
  });
});

describe('formatShortDate', () => {
  it('renders DD/MM/YY, as the design shows', () => {
    expect(formatShortDate('2026-08-04T03:00:00.000Z')).toBe('04/08/26');
  });

  it('renders a local-midnight instant as its own day', () => {
    // The date field submits local midnight, which in UTC-3 is 03:00Z. Reading
    // it back in local time gives the day the user picked.
    expect(formatShortDate(fromDateInputValue('2026-01-31'))).toBe('31/01/26');
  });

  it('pads a single-digit day and month', () => {
    expect(formatShortDate(fromDateInputValue('2026-03-07'))).toBe('07/03/26');
  });
});

describe('the date input conversions round-trip', () => {
  it('returns the same day it was given', () => {
    for (const day of [
      '2026-01-01',
      '2026-02-28',
      '2026-08-04',
      '2026-12-31',
    ]) {
      expect(toDateInputValue(fromDateInputValue(day))).toBe(day);
    }
  });

  it('submits local midnight, not UTC midnight', () => {
    // new Date('2026-08-04') would be UTC midnight, which is the 3rd locally.
    expect(fromDateInputValue('2026-08-04')).toBe('2026-08-04T03:00:00.000Z');
  });
});

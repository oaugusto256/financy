import {
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** The filter bar's "no period filter" value, and its default. */
export const ALL_PERIODS = '';

/** Twelve months, as frontend.md section 5 specifies. */
const MONTH_COUNT = 12;

const VALUE_FORMAT = 'yyyy-MM';

/**
 * date-fns `parse` is lenient about padding — `parse('2026-8', 'yyyy-MM', …)`
 * happily returns August 2026 — but `periodOptions()` only ever emits the
 * zero-padded form via `format`. An unpadded value would pass `isValid` and
 * still match no `<option>`, desyncing the select from the URL. This is the
 * shape every value `periodOptions()` produces, checked before `parse` gets
 * a chance to be lenient about it.
 */
const VALUE_SHAPE = /^\d{4}-\d{2}$/;

/**
 * "agosto de 2026" from date-fns, capitalised. Portuguese month names are
 * lowercase in prose, but this is a select option, and every other option in
 * the bar starts with a capital.
 */
export function monthLabel(month: Date): string {
  const label = format(month, "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The current month and the eleven before it, newest first, behind an "all"
 * option that is the default. The thirteenth option is a deviation from the
 * design, recorded in frontend.md section 12: without it, a first visit to
 * /transactions would hide every row outside the current month.
 *
 * `now` is a parameter so the tests are not written against the wall clock.
 */
export function periodOptions(
  now: Date = new Date(),
): { value: string; label: string }[] {
  const months = Array.from({ length: MONTH_COUNT }, (_, index) =>
    startOfMonth(subMonths(now, index)),
  );

  return [
    { value: ALL_PERIODS, label: 'Todos os períodos' },
    ...months.map((month) => ({
      value: format(month, VALUE_FORMAT),
      label: monthLabel(month),
    })),
  ];
}

/**
 * A `yyyy-MM` value to the inclusive instants the API's dateFrom/dateTo want.
 * Local, not UTC: a transaction recorded at 22:00 on the last day of the month
 * is in that month for the person who recorded it, and UTC boundaries would
 * push it into the next one for everyone west of Greenwich.
 *
 * Undefined for "all periods" and for anything unparseable — a hand-typed
 * ?period=banana must produce no filter, never a range of Invalid Date. Also
 * undefined for a right-shaped-but-unpadded value like `2026-8` or a
 * two-digit year like `26-08`: neither is a value `periodOptions()` would
 * ever produce, so accepting it would still leave the select unable to match
 * it to an `<option>`.
 */
export function periodRange(
  value: string,
): { dateFrom: string; dateTo: string } | undefined {
  if (!value || !VALUE_SHAPE.test(value)) return undefined;

  const month = parse(value, VALUE_FORMAT, new Date());
  if (!isValid(month)) return undefined;

  return {
    dateFrom: startOfMonth(month).toISOString(),
    dateTo: endOfMonth(month).toISOString(),
  };
}

/**
 * The month the dashboard's stat cards ask `summary(month, year)` for, read
 * from the browser's local time. The server windows that month in UTC, so on
 * the last day of a month in a negative-offset zone the two disagree for a few
 * hours — recorded as a deviation in frontend.md section 12.
 *
 * `now` is a parameter so the tests are not written against the wall clock,
 * like periodOptions above.
 */
export function currentPeriod(now: Date = new Date()): {
  month: number;
  year: number;
} {
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

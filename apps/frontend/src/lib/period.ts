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
 * "agosto de 2026" from date-fns, capitalised. Portuguese month names are
 * lowercase in prose, but this is a select option, and every other option in
 * the bar starts with a capital.
 */
function monthLabel(month: Date): string {
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
 * ?period=banana must produce no filter, never a range of Invalid Date.
 */
export function periodRange(
  value: string,
): { dateFrom: string; dateTo: string } | undefined {
  if (!value) return undefined;

  const month = parse(value, VALUE_FORMAT, new Date());
  if (!isValid(month)) return undefined;

  return {
    dateFrom: startOfMonth(month).toISOString(),
    dateTo: endOfMonth(month).toISOString(),
  };
}

import { format, parse, parseISO } from 'date-fns';

/**
 * Dates cross the API as ISO strings and are rendered in local time. The date
 * field submits local midnight, so a value written and read back lands on the
 * day the user picked — which is only true against a fixed zone, and why the
 * test script pins TZ.
 */
export function formatShortDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yy');
}

/** ISO instant to the `yyyy-MM-dd` an `<input type="date">` expects. */
export function toDateInputValue(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

/**
 * `yyyy-MM-dd` back to an ISO instant at **local** midnight. `new Date(value)`
 * would parse it as UTC midnight, which is the previous day everywhere west of
 * Greenwich — the whole audience of this application.
 */
export function fromDateInputValue(value: string): string {
  return parse(value, 'yyyy-MM-dd', new Date()).toISOString();
}

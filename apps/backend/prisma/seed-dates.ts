/**
 * Local midnight on `day` of the month `monthsAgo` months before `now`, matching
 * what the app's date field submits.
 *
 * Relative rather than fixed: the dashboard's stat cards read the current month,
 * so a seed with fixed dates shows a dashboard of zeros from the month after
 * those dates onward — a screen that looks broken while being correct.
 *
 * `new Date(year, monthIndex, day)` normalises a negative month index into the
 * previous year on its own, so December needs no special case. `now` is a
 * parameter so the tests are not written against the wall clock.
 */
export function monthsBack(
  monthsAgo: number,
  day: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
}

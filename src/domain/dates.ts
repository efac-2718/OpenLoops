/**
 * Loop dates are calendar days: "due Tuesday", not "due Tuesday 14:32".
 * They are stored as local midnight of that day.
 */

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The local calendar day as YYYY-MM-DD, used to record one nightly close per day. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Reads a YYYY-MM-DD day key back as local midnight of that day, or null if it isn't a real day. */
export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  // Rejects days that roll over, such as 2026-02-30.
  return dayKey(date) === key ? date : null;
}

export type QuickDate = { label: string; date: Date };

const MONDAY = 1;
const THURSDAY = 4;
const SATURDAY = 6;

/**
 * Days until the next `weekday` that is at least two days away, so it never
 * repeats "Today" or "Tomorrow" (on a Sunday, "Next week" is not tomorrow).
 */
function daysUntilAfterTomorrow(weekday: number, from: Date): number {
  const diff = (weekday - from.getDay() + 7) % 7;
  return diff < 2 ? diff + 7 : diff;
}

/** One-tap choices for when a scheduled next action happens. */
export function scheduleOptions(now: Date): QuickDate[] {
  const today = startOfDay(now);
  // Monday to Thursday; on Friday Saturday is "Tomorrow", and at the weekend it is already here.
  const weekendAhead = today.getDay() >= MONDAY && today.getDay() <= THURSDAY;
  return [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    ...(weekendAhead
      ? [{ label: 'This weekend', date: addDays(today, daysUntilAfterTomorrow(SATURDAY, today)) }]
      : []),
    { label: 'Next week', date: addDays(today, daysUntilAfterTomorrow(MONDAY, today)) },
  ];
}

/** One-tap choices for when to look at a "thinking on this" loop again. */
export function revisitOptions(now: Date): QuickDate[] {
  const today = startOfDay(now);
  return [
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'In 3 days', date: addDays(today, 3) },
    { label: 'In a week', date: addDays(today, 7) },
    { label: 'In a month', date: addDays(today, 30) },
  ];
}

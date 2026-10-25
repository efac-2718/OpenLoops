import { addDays, startOfDay } from '@/domain/dates';
import type { Loop } from '@/domain/loop';

/** "Today", "Tomorrow", "Yesterday", or a short date such as "Mon, Nov 2". */
export function formatDay(date: Date, now: Date): string {
  const day = startOfDay(date).getTime();
  const today = startOfDay(now);
  if (day === today.getTime()) return 'Today';
  if (day === addDays(today, 1).getTime()) return 'Tomorrow';
  if (day === addDays(today, -1).getTime()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** formatDay for the middle of a sentence: "since yesterday", "until tomorrow". */
export function formatDayInline(date: Date, now: Date): string {
  const label = formatDay(date, now);
  return ['Today', 'Tomorrow', 'Yesterday'].includes(label) ? label.toLowerCase() : label;
}

/** One line saying what has been decided for a loop. */
export function describeDecision(
  loop: Pick<Loop, 'state' | 'nextAction' | 'dueAt' | 'waitingOn' | 'revisitAt'>,
  now: Date,
): string {
  switch (loop.state) {
    case 'inbox':
      return 'Not decided yet';
    case 'next':
      return `Next: ${loop.nextAction}`;
    case 'scheduled':
      return loop.dueAt ? `${formatDay(loop.dueAt, now)}: ${loop.nextAction}` : `${loop.nextAction}`;
    case 'waiting':
      return `Waiting on ${loop.waitingOn}`;
    case 'thinking':
      return loop.revisitAt ? `Thinking on it until ${formatDayInline(loop.revisitAt, now)}` : 'Thinking on it';
    case 'done':
      return 'Done';
    case 'dropped':
      return 'Dropped';
  }
}

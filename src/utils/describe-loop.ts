import { addDays, startOfDay } from '@/domain/dates';
import { attentionReason, type Loop } from '@/domain/loop';

import { timeAgo } from './time-ago';

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

/**
 * What a loop's card shows: the thing to do as the main line, and the loop it
 * belongs to, its day, or who it waits on underneath.
 */
export function loopCardText(
  loop: Pick<
    Loop,
    'state' | 'title' | 'nextAction' | 'dueAt' | 'waitingOn' | 'revisitAt' | 'createdAt' | 'decidedAt' | 'deletedAt'
  >,
  now: Date,
): { title: string; detail: string; overdue: boolean } {
  const decided = loop.decidedAt ? timeAgo(loop.decidedAt, now) : null;
  switch (loop.state) {
    case 'scheduled': {
      const overdue = attentionReason(loop, now) === 'overdue';
      const day = loop.dueAt
        ? overdue
          ? `Overdue since ${formatDayInline(loop.dueAt, now)}`
          : formatDay(loop.dueAt, now)
        : '';
      return { title: loop.nextAction ?? loop.title, detail: `${day} · ${loop.title}`, overdue };
    }
    case 'next':
      return { title: loop.nextAction ?? loop.title, detail: loop.title, overdue: false };
    case 'waiting':
      return {
        title: loop.title,
        detail: `Waiting on ${loop.waitingOn}${decided ? ` · since ${decided}` : ''}`,
        overdue: false,
      };
    case 'thinking':
      return {
        title: loop.title,
        detail:
          attentionReason(loop, now) === 'revisit'
            ? 'Time to revisit'
            : `Revisit ${loop.revisitAt ? formatDayInline(loop.revisitAt, now) : 'later'}`,
        overdue: false,
      };
    case 'inbox':
      return { title: loop.title, detail: `Captured ${timeAgo(loop.createdAt, now)}`, overdue: false };
    default:
      return { title: loop.title, detail: describeDecision(loop, now), overdue: false };
  }
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

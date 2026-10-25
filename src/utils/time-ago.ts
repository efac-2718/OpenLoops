import { startOfDay } from '@/domain/dates';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function timeAgo(date: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24 && startOfDay(date).getTime() === startOfDay(now).getTime()) {
    return `${hours} h ago`;
  }

  // Round, not floor: a calendar day is 23 or 25 hours across a DST change.
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

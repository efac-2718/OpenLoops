/**
 * The nightly close reminder. Stored in settings as "HH:MM" (24-hour, local
 * time) or "off". With no setting there is no reminder, so the app never asks
 * for notification permission until the user picks a time.
 */

export type CloseTime = { hour: number; minute: number };

export const CLOSE_TIME_OPTIONS: readonly CloseTime[] = [
  { hour: 20, minute: 30 },
  { hour: 21, minute: 0 },
  { hour: 21, minute: 30 },
  { hour: 22, minute: 0 },
  { hour: 22, minute: 30 },
];

export function parseCloseTime(value: string | null | undefined): CloseTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatCloseTime({ hour, minute }: CloseTime): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function sameCloseTime(a: CloseTime | null, b: CloseTime | null): boolean {
  return a !== null && b !== null && a.hour === b.hour && a.minute === b.minute;
}

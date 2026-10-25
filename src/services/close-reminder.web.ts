// Browsers can't schedule a repeating local notification, so reminders are phone-only.

import type { ReminderResult } from './close-reminder';

export async function setCloseReminder(): Promise<ReminderResult> {
  return 'unsupported';
}

export async function sendTestReminder(): Promise<ReminderResult> {
  return 'unsupported';
}

export function useOpenCloseFromReminder() {}

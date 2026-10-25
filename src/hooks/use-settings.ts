import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { parseActiveCap, settingQuery } from '@/db/settings';
import { parseCloseTime, type CloseTime } from '@/domain/reminder';

export function useActiveCap(): number {
  const { data } = useLiveQuery(settingQuery('active_cap'));
  return parseActiveCap(data[0]?.value);
}

/** The nightly close reminder time, or null when there is no reminder. */
export function useCloseTime(): CloseTime | null {
  const { data } = useLiveQuery(settingQuery('close_time'));
  return parseCloseTime(data[0]?.value);
}

/** Whether this phone has agreed to send inbox loops to the AI server for suggestions. */
export function useAiSuggestionsEnabled(): boolean {
  const { data } = useLiveQuery(settingQuery('ai_suggestions'));
  return data[0]?.value === 'on';
}

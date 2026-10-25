import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect } from 'react';

import { todayCloseQuery } from '@/db/closes';
import { closeCandidatesQuery } from '@/db/loops';
import { dayKey } from '@/domain/dates';
import { glance } from '@/domain/glance';
import { updateHomeWidget } from '@/services/home-widget';

/** Pushes a fresh summary to the home-screen widget whenever the loops behind it change. */
export function useHomeWidgetSync() {
  const now = new Date();
  const { data: candidates, updatedAt } = useLiveQuery(closeCandidatesQuery());
  const { data: closes } = useLiveQuery(todayCloseQuery(now), [dayKey(now)]);

  const summary = glance(candidates, closes.length > 0, now);
  const { inbox, due, closedToday } = summary;

  useEffect(() => {
    // Wait for the first load, so the widget never flashes an empty summary.
    if (updatedAt) updateHomeWidget({ inbox, due, closedToday });
  }, [updatedAt, inbox, due, closedToday]);
}

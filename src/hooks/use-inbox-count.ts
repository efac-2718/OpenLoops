import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { inboxCountQuery } from '@/db/loops';

export function useInboxCount(): number {
  const { data } = useLiveQuery(inboxCountQuery());
  return data[0]?.count ?? 0;
}

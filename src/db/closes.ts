import { and, count, eq, gte, inArray, isNull, ne } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { dayKey, startOfDay } from '@/domain/dates';
import { canCloseDay, type Result } from '@/domain/loop';

import { getDb } from './client';
import { CLOSE_CANDIDATE_STATES } from './loops';
import { dailyCloses, loops } from './schema';

export function todayCloseQuery(now: Date) {
  return getDb()
    .select()
    .from(dailyCloses)
    .where(and(eq(dailyCloses.day, dayKey(now)), isNull(dailyCloses.deletedAt)))
    .limit(1);
}

/**
 * Records tonight's close. Refused while any loop still needs a decision, so
 * a recorded close always means everything had a home. Closing again on the
 * same day (after new loops came in) updates that day's record.
 */
export function closeDay(now: Date): Result<{ decidedToday: number }, 'loops_need_attention'> {
  return getDb().transaction((tx) => {
    const candidates = tx
      .select()
      .from(loops)
      .where(and(inArray(loops.state, [...CLOSE_CANDIDATE_STATES]), isNull(loops.deletedAt)))
      .all();
    if (!canCloseDay(candidates, now)) return { ok: false, error: 'loops_need_attention' } as const;

    // Loops given a decision today: how much the user actually closed.
    const decided = tx
      .select({ count: count() })
      .from(loops)
      .where(
        and(
          gte(loops.decidedAt, startOfDay(now)),
          ne(loops.state, 'inbox'),
          isNull(loops.deletedAt),
        ),
      )
      .get();
    const decidedToday = decided?.count ?? 0;

    const day = dayKey(now);
    const existing = tx
      .select({ id: dailyCloses.id })
      .from(dailyCloses)
      .where(and(eq(dailyCloses.day, day), isNull(dailyCloses.deletedAt)))
      .get();
    if (existing) {
      tx.update(dailyCloses)
        .set({ resolvedCount: decidedToday, updatedAt: now })
        .where(eq(dailyCloses.id, existing.id))
        .run();
    } else {
      tx.insert(dailyCloses)
        .values({ id: randomUUID(), day, resolvedCount: decidedToday, createdAt: now, updatedAt: now })
        .run();
    }
    return { ok: true, value: { decidedToday } } as const;
  });
}

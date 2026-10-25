import { asc, isNull } from 'drizzle-orm';

import type { ExportData } from '@/domain/export';

import { getDb } from './client';
import { dailyCloses, loops, settings, weeklyReviews } from './schema';

/** Every row the user still has; soft-deleted rows are gone as far as they know. */
export function readExportData(): ExportData {
  const db = getDb();
  return {
    loops: db.select().from(loops).where(isNull(loops.deletedAt)).orderBy(asc(loops.createdAt)).all(),
    dailyCloses: db
      .select({
        id: dailyCloses.id,
        day: dailyCloses.day,
        resolvedCount: dailyCloses.resolvedCount,
        createdAt: dailyCloses.createdAt,
        updatedAt: dailyCloses.updatedAt,
      })
      .from(dailyCloses)
      .where(isNull(dailyCloses.deletedAt))
      .orderBy(asc(dailyCloses.day))
      .all(),
    weeklyReviews: db
      .select({
        id: weeklyReviews.id,
        startedAt: weeklyReviews.startedAt,
        completedAt: weeklyReviews.completedAt,
        reviewedCount: weeklyReviews.reviewedCount,
        createdAt: weeklyReviews.createdAt,
        updatedAt: weeklyReviews.updatedAt,
      })
      .from(weeklyReviews)
      .where(isNull(weeklyReviews.deletedAt))
      .orderBy(asc(weeklyReviews.startedAt))
      .all(),
    settings: db.select().from(settings).orderBy(asc(settings.key)).all(),
  };
}

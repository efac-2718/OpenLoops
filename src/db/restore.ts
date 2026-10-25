import { eq } from 'drizzle-orm';

import { DEVICE_SETTINGS, planMerge, type Backup } from '@/domain/backup';

import { getDb, type Reader } from './client';
import { dailyCloses, loops, settings, weeklyReviews } from './schema';

export type RestoreSummary = {
  loops: { added: number; updated: number; unchanged: number };
  /** Nightly closes, weekly reviews, and settings added or updated. */
  history: number;
};

/** Backups don't carry deleted_at for these rows; deleted ones still count as existing. */
const withoutDeletedAt = <T extends { deletedAt: Date | null }>({ deletedAt: _deletedAt, ...row }: T) => row;

function plan(reader: Reader, backup: Backup) {
  // All rows, including soft-deleted ones, so a deletion isn't undone.
  return {
    loops: planMerge(reader.select().from(loops).all(), backup.loops, (row) => row.id),
    // One close per day: a close from another phone on the same day updates ours.
    dailyCloses: planMerge(
      reader.select().from(dailyCloses).all().map(withoutDeletedAt),
      backup.dailyCloses,
      (row) => row.day,
    ),
    weeklyReviews: planMerge(
      reader.select().from(weeklyReviews).all().map(withoutDeletedAt),
      backup.weeklyReviews,
      (row) => row.id,
    ),
    settings: planMerge(
      reader.select().from(settings).all(),
      backup.settings.filter((row) => !DEVICE_SETTINGS.includes(row.key)),
      (row) => row.key,
    ),
  };
}

function summarize(restore: ReturnType<typeof plan>): RestoreSummary {
  const changed = (merge: { insert: unknown[]; update: unknown[] }) =>
    merge.insert.length + merge.update.length;
  return {
    loops: {
      added: restore.loops.insert.length,
      updated: restore.loops.update.length,
      unchanged: restore.loops.unchanged,
    },
    history:
      changed(restore.dailyCloses) + changed(restore.weeklyReviews) + changed(restore.settings),
  };
}

/** What restoring this backup would change, without changing anything. */
export function previewRestore(backup: Backup): RestoreSummary {
  return summarize(plan(getDb(), backup));
}

/** Merges the backup in, all or nothing. */
export function applyRestore(backup: Backup): RestoreSummary {
  return getDb().transaction((tx) => {
    const restore = plan(tx, backup);

    for (const row of restore.loops.insert) tx.insert(loops).values(row).run();
    for (const { id, ...row } of restore.loops.update) {
      tx.update(loops).set(row).where(eq(loops.id, id)).run();
    }

    for (const row of restore.dailyCloses.insert) tx.insert(dailyCloses).values(row).run();
    for (const { id: _id, day, ...row } of restore.dailyCloses.update) {
      tx.update(dailyCloses).set(row).where(eq(dailyCloses.day, day)).run();
    }

    for (const row of restore.weeklyReviews.insert) tx.insert(weeklyReviews).values(row).run();
    for (const { id, ...row } of restore.weeklyReviews.update) {
      tx.update(weeklyReviews).set(row).where(eq(weeklyReviews.id, id)).run();
    }

    for (const row of restore.settings.insert) tx.insert(settings).values(row).run();
    for (const { key, ...row } of restore.settings.update) {
      tx.update(settings).set(row).where(eq(settings.key, key)).run();
    }

    return summarize(restore);
  });
}

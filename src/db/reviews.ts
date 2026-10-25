import { and, count, desc, eq, gte, inArray, isNotNull, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import type { Result } from '@/domain/loop';
import { canFinishReview } from '@/domain/review';

import { getDb } from './client';
import { loops, weeklyReviews } from './schema';

export type ReviewRow = typeof weeklyReviews.$inferSelect;

/** Every loop a review can ask about: anything not yet finished or dropped. */
const REVIEWABLE_STATES = ['inbox', 'scheduled', 'next', 'waiting', 'thinking'] as const;

export function reviewableLoopsQuery() {
  return getDb()
    .select()
    .from(loops)
    .where(and(inArray(loops.state, [...REVIEWABLE_STATES]), isNull(loops.deletedAt)));
}

export function openReviewQuery() {
  return getDb()
    .select()
    .from(weeklyReviews)
    .where(and(isNull(weeklyReviews.completedAt), isNull(weeklyReviews.deletedAt)))
    .orderBy(desc(weeklyReviews.startedAt))
    .limit(1);
}

export function lastFinishedReviewQuery() {
  return getDb()
    .select()
    .from(weeklyReviews)
    .where(and(isNotNull(weeklyReviews.completedAt), isNull(weeklyReviews.deletedAt)))
    .orderBy(desc(weeklyReviews.completedAt))
    .limit(1);
}

/** Starts a review, or returns the one already in progress so it can be resumed. */
export function startReview(now: Date): ReviewRow {
  return getDb().transaction((tx) => {
    const open = tx
      .select()
      .from(weeklyReviews)
      .where(and(isNull(weeklyReviews.completedAt), isNull(weeklyReviews.deletedAt)))
      .orderBy(desc(weeklyReviews.startedAt))
      .get();
    if (open) return open;

    const review: ReviewRow = {
      id: randomUUID(),
      startedAt: now,
      completedAt: null,
      reviewedCount: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    tx.insert(weeklyReviews).values(review).run();
    return review;
  });
}

/** Finishes a review. Refused while any step still has loops to look at. */
export function finishReview(
  id: string,
  now: Date,
): Result<{ reviewedCount: number }, 'not_finished' | 'not_found'> {
  return getDb().transaction((tx) => {
    const review = tx
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.id, id), isNull(weeklyReviews.completedAt)))
      .get();
    if (!review) return { ok: false, error: 'not_found' } as const;

    const open = tx
      .select()
      .from(loops)
      .where(and(inArray(loops.state, [...REVIEWABLE_STATES]), isNull(loops.deletedAt)))
      .all();
    if (!canFinishReview(open, review.startedAt)) return { ok: false, error: 'not_finished' } as const;

    // Includes loops finished or dropped during the review, not just the ones still open.
    const reviewed = tx
      .select({ count: count() })
      .from(loops)
      .where(and(gte(loops.reviewedAt, review.startedAt), isNull(loops.deletedAt)))
      .get();
    const reviewedCount = reviewed?.count ?? 0;

    tx.update(weeklyReviews)
      .set({ completedAt: now, reviewedCount, updatedAt: now })
      .where(eq(weeklyReviews.id, id))
      .run();
    return { ok: true, value: { reviewedCount } } as const;
  });
}

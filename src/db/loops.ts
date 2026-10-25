/**
 * The only module that writes loops. Every write goes through the domain
 * rules first, and this is the single place a sync layer would hook into.
 */

import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import * as rules from '@/domain/loop';
import type { Decision, DecisionChanges, DecisionError, Result } from '@/domain/loop';
import { keep, type KeepError } from '@/domain/review';

import { getDb } from './client';
import { loops } from './schema';
import { getActiveCap } from './settings';

export type LoopRow = typeof loops.$inferSelect;

const notDeleted = isNull(loops.deletedAt);

// Queries are returned unexecuted so screens can pass them to useLiveQuery.

export function inboxQuery() {
  return getDb()
    .select()
    .from(loops)
    .where(and(eq(loops.state, 'inbox'), notDeleted))
    .orderBy(asc(loops.createdAt));
}

export function inboxCountQuery() {
  return getDb()
    .select({ count: count() })
    .from(loops)
    .where(and(eq(loops.state, 'inbox'), notDeleted));
}

export function activeQuery() {
  return getDb()
    .select()
    .from(loops)
    .where(and(inArray(loops.state, [...rules.ACTIVE_STATES]), notDeleted))
    .orderBy(asc(loops.dueAt), asc(loops.decidedAt));
}

export function thinkingQuery() {
  return getDb()
    .select()
    .from(loops)
    .where(and(eq(loops.state, 'thinking'), notDeleted))
    .orderBy(asc(loops.revisitAt), asc(loops.decidedAt));
}

/** The only states that can need attention at the nightly close (see rules.attentionReason). */
export const CLOSE_CANDIDATE_STATES = ['inbox', 'scheduled', 'thinking'] as const;

/** Loops that might need attention tonight. Screens narrow them with rules.attentionReason. */
export function closeCandidatesQuery() {
  return getDb()
    .select()
    .from(loops)
    .where(and(inArray(loops.state, [...CLOSE_CANDIDATE_STATES]), notDeleted))
    .orderBy(asc(loops.createdAt));
}

export function loopQuery(id: string) {
  return getDb()
    .select()
    .from(loops)
    .where(and(eq(loops.id, id), notDeleted))
    .limit(1);
}

export function captureLoop(title: string): Result<LoopRow, rules.CaptureError> {
  const result = rules.captureLoop(title, { id: randomUUID(), now: new Date() });
  if (result.ok) {
    getDb().insert(loops).values(result.value).run();
  }
  return result;
}

/** Confirms during a review that a loop's decision still holds. */
export function keepLoop(id: string): Result<Pick<LoopRow, 'reviewedAt' | 'updatedAt'>, KeepError | 'not_found'> {
  return getDb().transaction((tx) => {
    const loop = tx
      .select()
      .from(loops)
      .where(and(eq(loops.id, id), notDeleted))
      .get();
    if (!loop) return { ok: false, error: 'not_found' } as const;

    const result = keep(loop, new Date());
    if (result.ok) {
      tx.update(loops).set(result.value).where(eq(loops.id, id)).run();
    }
    return result;
  });
}

/** Captures several thoughts at once, all or none, in the order given. */
export function captureLoops(titles: string[]): Result<LoopRow[], rules.CaptureError> {
  const now = Date.now();
  const captured: LoopRow[] = [];
  for (const [index, title] of titles.entries()) {
    // A millisecond apart, so the inbox (oldest first) keeps the order they were said in.
    const result = rules.captureLoop(title, { id: randomUUID(), now: new Date(now + index) });
    if (!result.ok) return result;
    captured.push(result.value);
  }
  if (captured.length > 0) {
    getDb().insert(loops).values(captured).run();
  }
  return { ok: true, value: captured };
}

export function decideLoop(
  id: string,
  decision: Decision,
): Result<DecisionChanges, DecisionError | 'not_found'> {
  return getDb().transaction((tx) => {
    const loop = tx
      .select({ state: loops.state })
      .from(loops)
      .where(and(eq(loops.id, id), notDeleted))
      .get();
    if (!loop) return { ok: false, error: 'not_found' } as const;

    const active = tx
      .select({ count: count() })
      .from(loops)
      .where(and(inArray(loops.state, [...rules.ACTIVE_STATES]), notDeleted))
      .get();

    const result = rules.decide(loop, decision, {
      now: new Date(),
      activeCount: active?.count ?? 0,
      activeCap: getActiveCap(tx),
    });
    if (result.ok) {
      tx.update(loops).set(result.value).where(eq(loops.id, id)).run();
    }
    return result;
  });
}

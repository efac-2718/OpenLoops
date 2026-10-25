/**
 * The only module that writes loops. Every write goes through the domain
 * rules first, and this is the single place a sync layer would hook into.
 */

import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import * as rules from '@/domain/loop';
import type { Decision, DecisionChanges, DecisionError, Result } from '@/domain/loop';

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

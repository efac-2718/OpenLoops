/**
 * AI suggestions saved on the phone, so they outlast the app closing. Each is
 * kept as the model wrote it and checked again when read.
 */

import { and, eq, isNull, notInArray } from 'drizzle-orm';

import { readSavedSuggestion, type Suggestion } from '@/domain/ai-sort';

import { getDb } from './client';
import type { LoopRow } from './loops';
import { aiSuggestions, loops } from './schema';

export function savedSuggestionsQuery() {
  return getDb().select().from(aiSuggestions);
}

/** Saves new suggestions, and forgets those for loops that have left the inbox. */
export function saveSuggestions(entries: { answer: unknown; loop: Pick<LoopRow, 'id' | 'updatedAt'> }[]) {
  const createdAt = new Date();
  getDb().transaction((tx) => {
    for (const { answer, loop } of entries) {
      const row = { loopId: loop.id, answer: JSON.stringify(answer), loopUpdatedAt: loop.updatedAt, createdAt };
      tx.insert(aiSuggestions).values(row).onConflictDoUpdate({ target: aiSuggestions.loopId, set: row }).run();
    }
    const inbox = tx
      .select({ id: loops.id })
      .from(loops)
      .where(and(eq(loops.state, 'inbox'), isNull(loops.deletedAt)));
    tx.delete(aiSuggestions).where(notInArray(aiSuggestions.loopId, inbox)).run();
  });
}

export function clearSavedSuggestions() {
  getDb().delete(aiSuggestions).run();
}

/** Reads one loop's saved suggestion right away, for a screen that opens filled in. */
export function savedSuggestionFor(loop: Pick<LoopRow, 'id' | 'updatedAt'>, now: Date): Suggestion | null {
  const row = getDb().select().from(aiSuggestions).where(eq(aiSuggestions.loopId, loop.id)).get();
  return readSavedSuggestion(row, loop, now);
}

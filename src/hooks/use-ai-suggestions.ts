/**
 * AI suggestions for inbox loops. They're saved on the phone
 * (src/db/suggestions.ts), so they outlast the app closing; how the latest
 * request went is kept in memory. A suggestion belongs to the loop as the AI
 * saw it: once the loop is edited, it is no longer offered.
 */

import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useSyncExternalStore } from 'react';

import type { LoopRow } from '@/db/loops';
import { clearSavedSuggestions, savedSuggestionsQuery, saveSuggestions } from '@/db/suggestions';
import { buildSortRequest, parseSuggestions, readSavedSuggestion, type Suggestion } from '@/domain/ai-sort';
import { callAi, type AiCallError } from '@/services/ai';

export type AiSuggestions = {
  status: 'idle' | 'loading' | 'done' | 'error';
  error: AiCallError | null;
  /** The technical detail behind the last error, if any. */
  detail: string | null;
  /** How many suggestions the last request brought back. */
  received: number;
};

const IDLE: AiSuggestions = { status: 'idle', error: null, detail: null, received: 0 };
let state = IDLE;
const listeners = new Set<() => void>();

function update(changes: Partial<AiSuggestions>) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How the latest request went, outside React. */
export function getAiSuggestions(): AiSuggestions {
  return state;
}

export function useAiSuggestions(): AiSuggestions {
  return useSyncExternalStore(subscribe, getAiSuggestions, getAiSuggestions);
}

/** Looks up the saved suggestion for a loop, kept up to date as suggestions are saved or cleared. */
export function useSavedSuggestions(): (loop: Pick<LoopRow, 'id' | 'updatedAt'>) => Suggestion | null {
  const { data } = useLiveQuery(savedSuggestionsQuery());
  const now = new Date();
  const saved = new Map(data.map((row) => [row.loopId, row]));
  return (loop) => readSavedSuggestion(saved.get(loop.id), loop, now);
}

/** Forgets every suggestion, for when AI suggestions are turned off. */
export function clearSuggestions(): void {
  clearSavedSuggestions();
  update(IDLE);
}

/** Asks for suggestions for the given loops (the first batch of them, oldest first) and saves them. */
export async function requestSuggestions(
  loops: LoopRow[],
  context: { activeCount: number; activeCap: number },
): Promise<void> {
  if (state.status === 'loading' || loops.length === 0) return;
  const now = new Date();
  const request = buildSortRequest(loops, { now, ...context });
  update({ status: 'loading', error: null, detail: null });

  const result = await callAi('sort', request);
  if (!result.ok) {
    update({ status: 'error', error: result.error, detail: result.detail ?? null });
    return;
  }

  const asked = new Map(loops.slice(0, request.loops.length).map((loop) => [loop.id, loop]));
  const suggestions = parseSuggestions(result.value, [...asked.keys()], now);
  const answers = (result.value as { suggestions: { id: string }[] }).suggestions;
  saveSuggestions(
    suggestions.flatMap(({ loopId }) => {
      const loop = asked.get(loopId);
      const answer = answers.find((item) => item.id === loopId);
      return loop && answer ? [{ loop, answer }] : [];
    }),
  );
  update({ status: 'done', received: suggestions.length });
}

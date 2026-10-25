/**
 * Suggested decisions for inbox loops, kept in memory while the app runs so the
 * Inbox and Decide screens share them. A suggestion belongs to the loop as
 * Claude saw it: once the loop is edited, it is no longer offered.
 */

import { useSyncExternalStore } from 'react';

import type { LoopRow } from '@/db/loops';
import { buildSortRequest, parseSuggestions, type Suggestion } from '@/domain/ai-sort';
import { fetchSuggestions, type AiSortError } from '@/services/ai-sort';

type Entry = { suggestion: Suggestion; loopUpdatedAt: number };

export type AiSuggestions = {
  status: 'idle' | 'loading' | 'done' | 'error';
  error: AiSortError | null;
  /** How many suggestions the last request brought back. */
  received: number;
  entries: ReadonlyMap<string, Entry>;
};

let state: AiSuggestions = { status: 'idle', error: null, received: 0, entries: new Map() };
const listeners = new Set<() => void>();

function update(changes: Partial<AiSuggestions>) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current suggestions, outside React. */
export function getAiSuggestions(): AiSuggestions {
  return state;
}

export function useAiSuggestions(): AiSuggestions {
  return useSyncExternalStore(subscribe, getAiSuggestions, getAiSuggestions);
}

export function suggestionFor(
  suggestions: AiSuggestions,
  loop: Pick<LoopRow, 'id' | 'updatedAt'>,
): Suggestion | null {
  const entry = suggestions.entries.get(loop.id);
  return entry && entry.loopUpdatedAt === loop.updatedAt.getTime() ? entry.suggestion : null;
}

/** Forgets every suggestion, for when AI suggestions are turned off. */
export function clearSuggestions(): void {
  update({ status: 'idle', error: null, received: 0, entries: new Map() });
}

/** Asks for suggestions for the given loops (the first batch of them, oldest first). */
export async function requestSuggestions(
  loops: LoopRow[],
  context: { activeCount: number; activeCap: number },
): Promise<void> {
  if (state.status === 'loading' || loops.length === 0) return;
  const now = new Date();
  const request = buildSortRequest(loops, { now, ...context });
  update({ status: 'loading', error: null });

  const result = await fetchSuggestions(request);
  if (!result.ok) {
    update({ status: 'error', error: result.error });
    return;
  }

  const asked = new Map(loops.slice(0, request.loops.length).map((loop) => [loop.id, loop]));
  const suggestions = parseSuggestions(result.value, [...asked.keys()], now);
  const entries = new Map(state.entries);
  for (const suggestion of suggestions) {
    const loop = asked.get(suggestion.loopId);
    if (loop) entries.set(loop.id, { suggestion, loopUpdatedAt: loop.updatedAt.getTime() });
  }
  update({ status: 'done', received: suggestions.length, entries });
}

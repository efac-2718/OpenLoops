/**
 * AI sorting: the app sends the inbox to Claude, which suggests one decision
 * per loop. These are the rules both ends share: what a request may contain,
 * and how the model's answer becomes suggestions the app can offer. A
 * suggestion is only ever offered: the person accepts or changes it, and the
 * usual decision rules apply when they do.
 */

import { dayKey, parseDayKey, startOfDay } from './dates';
import type { Decision, DecisionKind, Loop, Result } from './loop';

/** How many loops one request covers; a bigger inbox is sorted oldest first, in batches. */
export const MAX_LOOPS_PER_SORT = 25;
export const MAX_TITLE_LENGTH = 2000;
export const MAX_NOTES_LENGTH = 4000;
const MAX_ID_LENGTH = 100;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DECISION_KINDS: DecisionKind[] = ['done', 'next', 'scheduled', 'waiting', 'thinking', 'dropped'];

export type SortRequest = {
  /** The person's local day (YYYY-MM-DD); suggested days are never before it. */
  today: string;
  weekday: string;
  activeCount: number;
  activeCap: number;
  loops: { id: string; title: string; notes: string | null; captured: string }[];
};

/** One suggestion as the model writes it (see SUGGESTIONS_SCHEMA in src/server). */
export type RawSuggestion = {
  id: string;
  decision: DecisionKind;
  next_action: string | null;
  day: string | null;
  waiting_on: string | null;
  reason: string;
};

export type Suggestion = { loopId: string; decision: Decision; reason: string };

export function buildSortRequest(
  loops: Pick<Loop, 'id' | 'title' | 'notes' | 'createdAt'>[],
  { now, activeCount, activeCap }: { now: Date; activeCount: number; activeCap: number },
): SortRequest {
  return {
    today: dayKey(now),
    weekday: WEEKDAYS[now.getDay()],
    activeCount,
    activeCap,
    loops: loops.slice(0, MAX_LOOPS_PER_SORT).map((loop) => ({
      id: loop.id,
      // Only extreme pastes reach these limits; the start of the text is enough for a suggestion.
      title: loop.title.slice(0, MAX_TITLE_LENGTH),
      notes: loop.notes?.slice(0, MAX_NOTES_LENGTH) ?? null,
      captured: dayKey(loop.createdAt),
    })),
  };
}

const isString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length <= maxLength;

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000;

/** The server's check on what it is asked to sort, before anything reaches the model. */
export function validateSortRequest(body: unknown): Result<SortRequest, 'invalid'> {
  const invalid = { ok: false, error: 'invalid' } as const;
  if (typeof body !== 'object' || body === null) return invalid;
  const { today, weekday, activeCount, activeCap, loops } = body as Record<string, unknown>;

  if (!isString(today, 10) || !parseDayKey(today)) return invalid;
  if (!isString(weekday, 9) || !WEEKDAYS.includes(weekday)) return invalid;
  if (!isCount(activeCount) || !isCount(activeCap)) return invalid;
  if (!Array.isArray(loops) || loops.length === 0 || loops.length > MAX_LOOPS_PER_SORT) {
    return invalid;
  }

  const checked: SortRequest['loops'] = [];
  for (const loop of loops) {
    if (typeof loop !== 'object' || loop === null) return invalid;
    const { id, title, notes, captured } = loop as Record<string, unknown>;
    if (!isString(id, MAX_ID_LENGTH) || !id) return invalid;
    if (!isString(title, MAX_TITLE_LENGTH) || !title.trim()) return invalid;
    if (notes !== null && !isString(notes, MAX_NOTES_LENGTH)) return invalid;
    if (!isString(captured, 10) || !parseDayKey(captured)) return invalid;
    checked.push({ id, title, notes, captured });
  }
  return { ok: true, value: { today, weekday, activeCount, activeCap, loops: checked } };
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Turns the model's answer into suggestions for the loops that were asked
 * about. Anything that wouldn't make a valid decision (a missing next action, a
 * day in the past, an unknown loop) is left out rather than offered.
 */
export function parseSuggestions(answer: unknown, askedIds: string[], now: Date): Suggestion[] {
  const items = (answer as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(items)) return [];

  const remaining = new Set(askedIds);
  const suggestions: Suggestion[] = [];
  for (const item of items) {
    const suggestion = parseSuggestion(item, now);
    if (!suggestion || !remaining.has(suggestion.loopId)) continue;
    remaining.delete(suggestion.loopId);
    suggestions.push(suggestion);
  }
  return suggestions;
}

/**
 * One suggestion as the model wrote it, or null if it wouldn't make a valid
 * decision today. Saved suggestions are read through this too, so one for a day
 * that has since passed is no longer offered.
 */
export function parseSuggestion(item: unknown, now: Date): Suggestion | null {
  if (typeof item !== 'object' || item === null) return null;
  const raw = item as Record<string, unknown>;
  const loopId = text(raw.id);
  if (!loopId) return null;

  const today = startOfDay(now);
  const day = (value: unknown): Date | null => {
    const date = parseDayKey(text(value));
    return date && date >= today ? date : null;
  };
  const decision = toDecision(raw, day);
  return decision ? { loopId, decision, reason: text(raw.reason) } : null;
}

/** A suggestion saved on the phone: the answer as the model wrote it, and the loop version it was for. */
export type SavedSuggestion = { loopId: string; answer: string; loopUpdatedAt: Date };

/**
 * A saved suggestion for the loop as it is now, or null once the loop has been
 * edited or the suggestion no longer makes a valid decision.
 */
export function readSavedSuggestion(
  saved: SavedSuggestion | undefined,
  loop: Pick<Loop, 'id' | 'updatedAt'>,
  now: Date,
): Suggestion | null {
  if (!saved || saved.loopId !== loop.id || saved.loopUpdatedAt.getTime() !== loop.updatedAt.getTime()) {
    return null;
  }
  try {
    const suggestion = parseSuggestion(JSON.parse(saved.answer), now);
    return suggestion?.loopId === loop.id ? suggestion : null;
  } catch {
    return null;
  }
}

function toDecision(raw: Record<string, unknown>, day: (value: unknown) => Date | null): Decision | null {
  const nextAction = text(raw.next_action);
  const waitingOn = text(raw.waiting_on);
  switch (raw.decision) {
    case 'done':
    case 'dropped':
      return { kind: raw.decision };
    case 'next':
      return nextAction ? { kind: 'next', nextAction } : null;
    case 'scheduled': {
      const dueAt = day(raw.day);
      return nextAction && dueAt ? { kind: 'scheduled', nextAction, dueAt } : null;
    }
    case 'waiting':
      return waitingOn ? { kind: 'waiting', waitingOn } : null;
    case 'thinking': {
      const revisitAt = day(raw.day);
      return revisitAt ? { kind: 'thinking', revisitAt } : null;
    }
    default:
      return null;
  }
}

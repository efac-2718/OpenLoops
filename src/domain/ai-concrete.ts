/**
 * "Make it concrete": the AI rewrites a vague next action ("sort out taxes")
 * as one physical step. These are the rules both ends share: what a request
 * may contain, and how the answer is read.
 */

import type { Loop, Result } from './loop';

const MAX_TITLE_LENGTH = 2000;
const MAX_NOTES_LENGTH = 4000;
const MAX_ACTION_LENGTH = 1000;

export type ConcreteRequest = { title: string; notes: string | null; nextAction: string };

/** What comes back, as the model writes it (see the schema in src/server/tasks/concrete.ts). */
export type RawConcrete = { next_action: string; reason: string };

export type ConcreteAction = { nextAction: string; reason: string };

export function buildConcreteRequest(loop: Pick<Loop, 'title' | 'notes'>, nextAction: string): ConcreteRequest {
  // Only extreme pastes reach these limits; the start of the text is enough for a suggestion.
  return {
    title: loop.title.slice(0, MAX_TITLE_LENGTH),
    notes: loop.notes?.slice(0, MAX_NOTES_LENGTH) ?? null,
    nextAction: nextAction.trim().slice(0, MAX_ACTION_LENGTH),
  };
}

const isText = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length <= maxLength;

export function validateConcreteRequest(body: unknown): Result<ConcreteRequest, 'invalid'> {
  const invalid = { ok: false, error: 'invalid' } as const;
  if (typeof body !== 'object' || body === null) return invalid;
  const { title, notes, nextAction } = body as Record<string, unknown>;
  if (!isText(title, MAX_TITLE_LENGTH) || !title.trim()) return invalid;
  if (notes !== null && !isText(notes, MAX_NOTES_LENGTH)) return invalid;
  if (!isText(nextAction, MAX_ACTION_LENGTH)) return invalid;
  return { ok: true, value: { title, notes, nextAction } };
}

/** Reads the answer; null unless it has a next action. */
export function readConcrete(answer: unknown): ConcreteAction | null {
  if (typeof answer !== 'object' || answer === null) return null;
  const { next_action: nextAction, reason } = answer as Record<string, unknown>;
  if (typeof nextAction !== 'string' || !nextAction.trim()) return null;
  return { nextAction: nextAction.trim(), reason: typeof reason === 'string' ? reason.trim() : '' };
}

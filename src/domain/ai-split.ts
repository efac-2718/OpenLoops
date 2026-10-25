/**
 * Smart brain dump: the AI turns everything someone said at once into separate
 * loops, each with a short title, and keeps their own words as its notes.
 * These are the rules both ends share.
 */

import type { Result } from './loop';

export const MAX_SPLIT_TEXT_LENGTH = 4000;
export const MAX_SPLIT_LOOPS = 25;
const MAX_TITLE_LENGTH = 300;

export type SplitRequest = { text: string };

/** What comes back, as the model writes it (see the schema in src/server/tasks/split.ts). */
export type RawSplit = { loops: { title: string; words: string }[] };

export type SplitLoop = { title: string; notes: string | null };

export function validateSplitRequest(body: unknown): Result<SplitRequest, 'invalid'> {
  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_SPLIT_TEXT_LENGTH) {
    return { ok: false, error: 'invalid' };
  }
  return { ok: true, value: { text } };
}

/**
 * Reads the answer into loops to capture. A loop's notes are the words it came
 * from, unless they say no more than its title. Null when nothing usable came back.
 */
export function readSplit(answer: unknown): SplitLoop[] | null {
  const loops = (answer as { loops?: unknown } | null)?.loops;
  if (!Array.isArray(loops)) return null;

  const read: SplitLoop[] = [];
  for (const loop of loops.slice(0, MAX_SPLIT_LOOPS)) {
    if (typeof loop !== 'object' || loop === null) continue;
    const { title, words } = loop as Record<string, unknown>;
    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, MAX_TITLE_LENGTH) : '';
    if (!cleanTitle) continue;
    const cleanWords = typeof words === 'string' ? words.trim() : '';
    const sameAsTitle = cleanWords.toLowerCase().replace(/[.!?]$/, '') === cleanTitle.toLowerCase();
    read.push({ title: cleanTitle, notes: cleanWords && !sameAsTitle ? cleanWords : null });
  }
  return read.length > 0 ? read : null;
}

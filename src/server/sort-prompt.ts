/**
 * Server-only: what every AI service is asked, and how its answer is read.
 * The services themselves are in claude.ts and gemini.ts.
 */

import { DECISION_KINDS, type RawSuggestion } from '@/domain/ai-sort';

export type SuggestError = 'not_configured' | 'busy' | 'refused' | 'failed';
/** A failure can carry a short technical detail, passed to the app so a problem can be diagnosed from the phone. */
export type SuggestResult =
  | { ok: true; value: { suggestions: RawSuggestion[] } }
  | { ok: false; error: SuggestError; detail?: string };

/** One line describing an error, with the API key blanked out in case it ever appears. */
export function describeFailure(error: unknown, apiKey: string): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.split(apiKey).join('[key]').replace(/\s+/g, ' ').slice(0, 300);
}

const nullableText = { anyOf: [{ type: 'string' }, { type: 'null' }] };

export const SUGGESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          decision: { type: 'string', enum: DECISION_KINDS },
          next_action: nullableText,
          day: nullableText,
          waiting_on: nullableText,
          reason: { type: 'string' },
        },
        required: ['id', 'decision', 'next_action', 'day', 'waiting_on', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

export const SYSTEM_PROMPT = `You help someone use Open Loops, an app for getting things off their mind, based on Getting Things Done. Each loop in their inbox is something on their mind that has no decision yet. Unmade decisions keep nagging at people; a concrete plan lets them stop thinking about it. Suggest one decision per loop:

- done: it takes about two minutes, so they should just do it now.
- next: one concrete next step they can take whenever they have time. Write it in next_action.
- scheduled: the next step belongs on a particular day (a deadline, an appointment, something time-bound). Write it in next_action and pick the day.
- waiting: someone else has the next move. Name them in waiting_on.
- thinking: an idea or choice they are not ready to commit to; leave it open on purpose and pick a day to revisit it.
- dropped: it no longer matters, or was never really theirs to do. Letting go on purpose is a valid decision.

A next action is one visible, physical step that starts with a verb, such as "Email Sam to ask for the invoice" rather than "Sort out invoice". Write it in the language of the loop. Use the details in the loop and its notes, and don't invent names, places, numbers or dates.

Days are YYYY-MM-DD and never before today. When a loop implies a day ("on Friday", "before the 3rd"), use it; otherwise pick a realistic day soon. Revisit a thinking loop in about a week unless the loop suggests otherwise. Use null for fields a decision doesn't need.

Next, scheduled and waiting loops are active, and the person can have at most activeCap active loops; they already have activeCount. Don't suggest more active loops than fit: choose thinking or dropped for the least pressing ones, and say so in the reason.

The reason is one short sentence they can take in at a glance. Return a suggestion for every loop, with its id.`;

/** Reads the JSON answer. Each suggestion is checked again in the app (parseSuggestions). */
export function readSuggestions(text: string | undefined): SuggestResult {
  try {
    const parsed = JSON.parse(text ?? '') as { suggestions?: unknown };
    if (!Array.isArray(parsed.suggestions)) {
      return { ok: false, error: 'failed', detail: 'The answer had no list of suggestions.' };
    }
    return { ok: true, value: { suggestions: parsed.suggestions as RawSuggestion[] } };
  } catch {
    return { ok: false, error: 'failed', detail: 'The answer wasn’t valid JSON.' };
  }
}

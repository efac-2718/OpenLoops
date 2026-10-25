/** Server-only: AI sorting, a suggested decision for each inbox loop (POST /api/sort). */

import { DECISION_KINDS, type RawSuggestion, type SortRequest } from '@/domain/ai-sort';

import type { AiTask } from '../ai-task';

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

export const SORT_PROMPT = `You help someone use Open Loops, an app for getting things off their mind, based on Getting Things Done. Each loop in their inbox is something on their mind that has no decision yet. Unmade decisions keep nagging at people; a concrete plan lets them stop thinking about it. Suggest one decision per loop:

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

export function sortTask(request: SortRequest): AiTask<{ suggestions: RawSuggestion[] }> {
  return {
    name: 'sort',
    size: request.loops.length,
    system: SORT_PROMPT,
    input: JSON.stringify(request),
    schema: SUGGESTIONS_SCHEMA,
    // Each suggestion is checked in the app (parseSuggestions); here, only the list.
    read: (answer) => {
      const suggestions = (answer as { suggestions?: unknown } | null)?.suggestions;
      return Array.isArray(suggestions) ? { suggestions: suggestions as RawSuggestion[] } : null;
    },
  };
}

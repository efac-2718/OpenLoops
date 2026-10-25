/**
 * Server-only: asks Claude for a suggested decision per inbox loop. Imported by
 * src/app/api/sort+api.ts, which runs on EAS Hosting, so the API key never
 * reaches the app. Never import this from app code.
 */

import Anthropic from '@anthropic-ai/sdk';

import { DECISION_KINDS, type RawSuggestion, type SortRequest } from '@/domain/ai-sort';
import type { Result } from '@/domain/loop';

const MODEL = 'claude-opus-5-5';

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

const SYSTEM_PROMPT = `You help someone use Open Loops, an app for getting things off their mind, based on Getting Things Done. Each loop in their inbox is something on their mind that has no decision yet. Unmade decisions keep nagging at people; a concrete plan lets them stop thinking about it. Suggest one decision per loop:

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

export type SuggestError = 'not_configured' | 'busy' | 'refused' | 'failed';

export async function suggestDecisions(
  request: SortRequest,
  apiKey: string | undefined,
): Promise<Result<{ suggestions: RawSuggestion[] }, SuggestError>> {
  if (!apiKey) return { ok: false, error: 'not_configured' };
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // A safety decline is retried on Anthropic's recommended fallback model instead of failing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Sorting a short list is light work; low effort keeps the wait short.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: SUGGESTIONS_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(request) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error('AI sorting: the Anthropic API key was rejected.');
      return { ok: false, error: 'not_configured' };
    }
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: 'busy' };
    console.error('AI sorting: the request to Claude failed.', error);
    return { ok: false, error: 'failed' };
  }

  // Counts only, never the loops themselves.
  console.info(
    `AI sorting: ${request.loops.length} loops, ${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens, ${response.model}, ${response.stop_reason}`,
  );
  if (response.stop_reason === 'refusal') return { ok: false, error: 'refused' };
  if (response.stop_reason !== 'end_turn') return { ok: false, error: 'failed' };

  const answer = response.content.find((block) => block.type === 'text');
  try {
    const parsed = JSON.parse(answer?.text ?? '') as { suggestions?: unknown };
    if (!Array.isArray(parsed.suggestions)) return { ok: false, error: 'failed' };
    return { ok: true, value: { suggestions: parsed.suggestions as RawSuggestion[] } };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

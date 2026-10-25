/**
 * Server-only: suggestions from Anthropic's Claude. The API key is the
 * ANTHROPIC_API_KEY environment variable on EAS Hosting and never reaches the app.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { SortRequest } from '@/domain/ai-sort';

import {
  describeFailure,
  readSuggestions,
  SUGGESTIONS_SCHEMA,
  SYSTEM_PROMPT,
  type SuggestResult,
} from './sort-prompt';

const MODEL = 'claude-opus-5-5';

export async function suggestWithClaude(request: SortRequest, apiKey: string | undefined): Promise<SuggestResult> {
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
    return { ok: false, error: 'failed', detail: `Claude: ${describeFailure(error, apiKey)}` };
  }

  // Counts only, never the loops themselves.
  console.info(
    `AI sorting: ${request.loops.length} loops, ${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens, ${response.model}, ${response.stop_reason}`,
  );
  if (response.stop_reason === 'refusal') return { ok: false, error: 'refused' };
  if (response.stop_reason !== 'end_turn') {
    return { ok: false, error: 'failed', detail: `Claude stopped with ${response.stop_reason}.` };
  }

  return readSuggestions(response.content.find((block) => block.type === 'text')?.text);
}

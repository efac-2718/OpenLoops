/**
 * Server-only: runs an AI task on Anthropic's Claude. The API key is the
 * ANTHROPIC_API_KEY environment variable on EAS Hosting and never reaches the app.
 */

import Anthropic from '@anthropic-ai/sdk';

import { describeFailure, readAnswer, type AiResult, type AiTask } from './ai-task';

const MODEL = 'claude-opus-5-5';

export async function askClaude<T>(task: AiTask<T>, apiKey: string | undefined): Promise<AiResult<T>> {
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
      // These are short, light tasks; low effort keeps the wait short.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: task.schema as { [key: string]: unknown } },
      },
      system: task.system,
      messages: [{ role: 'user', content: task.input }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error(`AI ${task.name}: the Anthropic API key was rejected.`);
      return { ok: false, error: 'not_configured' };
    }
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: 'busy' };
    console.error(`AI ${task.name}: the request to Claude failed.`, error);
    return { ok: false, error: 'failed', detail: `Claude: ${describeFailure(error, apiKey)}` };
  }

  // Counts only, never what was sent.
  console.info(
    `AI ${task.name}: ${task.size} items, ${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens, ${response.model}, ${response.stop_reason}`,
  );
  if (response.stop_reason === 'refusal') return { ok: false, error: 'refused' };
  if (response.stop_reason !== 'end_turn') {
    return { ok: false, error: 'failed', detail: `Claude stopped with ${response.stop_reason}.` };
  }

  const value = readAnswer(task, response.content.find((block) => block.type === 'text')?.text);
  return value === null
    ? { ok: false, error: 'failed', detail: 'Claude’s answer wasn’t usable.' }
    : { ok: true, value };
}

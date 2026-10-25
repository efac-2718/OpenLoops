/**
 * Server-only: suggestions from Google's Gemini, on the Gemini API's free tier.
 * The API key is the GEMINI_API_KEY environment variable on EAS Hosting and
 * never reaches the app.
 *
 * The free tier's newest models are often overloaded: they answer 503 "high
 * demand", or don't answer at all. So each model gets a short time limit, and
 * when one is unavailable the next on the list is asked. The REST API is called
 * with fetch, which keeps those limits in our hands.
 */

import type { SortRequest } from '@/domain/ai-sort';

import {
  describeFailure,
  readSuggestions,
  SUGGESTIONS_SCHEMA,
  SYSTEM_PROMPT,
  type SuggestResult,
} from './sort-prompt';

/**
 * Tried in order until one answers. Measured on 25 Oct 2026: the newest Flash
 * (gemini-flash-latest) was overloaded every time, while Flash-Lite answered in
 * under a second; gemini-2.5-flash is closed to new keys.
 */
export const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-flash-latest'];
const ATTEMPT_TIMEOUT_MS = 25_000;
// Ends a runaway answer (JSON mode can repeat itself) instead of letting it run for minutes.
const MAX_OUTPUT_TOKENS = 8192;

const DECLINED = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'];
// Overloaded, out of this model's free quota, failing, or not offered to this key: ask the next model.
const TRY_NEXT = [404, 429, 500, 502, 503, 504];

type GeminiResponse = {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
  error?: { message?: string };
};

/** A model's answer, or a reason to ask the next one. */
type Attempt = { result: SuggestResult } | { unavailable: string };

export async function suggestWithGemini(request: SortRequest, apiKey: string | undefined): Promise<SuggestResult> {
  if (!apiKey) return { ok: false, error: 'not_configured' };

  const unavailable: string[] = [];
  for (const model of GEMINI_MODELS) {
    const attempt = await ask(model, request, apiKey);
    if ('result' in attempt) return attempt.result;
    console.info(`AI sorting: ${attempt.unavailable}`);
    unavailable.push(attempt.unavailable);
  }
  return { ok: false, error: 'busy', detail: unavailable.join(' · ').slice(0, 300) };
}

async function ask(model: string, request: SortRequest, apiKey: string): Promise<Attempt> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ATTEMPT_TIMEOUT_MS);
  let status: number;
  let body: GeminiResponse | null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: SUGGESTIONS_SCHEMA,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        }),
        signal: abort.signal,
      },
    );
    status = response.status;
    body = (await response.json().catch(() => null)) as GeminiResponse | null;
  } catch (error) {
    if (abort.signal.aborted) return { unavailable: `${model}: no answer in ${ATTEMPT_TIMEOUT_MS / 1000} s` };
    console.error('AI sorting: the request to Gemini failed.', error);
    return { result: { ok: false, error: 'failed', detail: `Gemini: ${describeFailure(error, apiKey)}` } };
  } finally {
    clearTimeout(timer);
  }

  if (status !== 200) {
    const message = body?.error?.message ?? '';
    if (TRY_NEXT.includes(status)) return { unavailable: `${model} ${status}: ${message.slice(0, 80)}` };
    const detail = `Gemini ${status}: ${message}`.slice(0, 300);
    // A wrong key comes back as a 400 that names it; a missing permission as 401 or 403.
    if (status === 401 || status === 403 || (status === 400 && /API key/i.test(message))) {
      console.error('AI sorting: the Gemini API key was rejected.');
      return { result: { ok: false, error: 'not_configured', detail } };
    }
    console.error(`AI sorting: ${detail}`);
    return { result: { ok: false, error: 'failed', detail } };
  }

  const candidate = body?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  // Counts only, never the loops themselves.
  console.info(
    `AI sorting: ${request.loops.length} loops, ${body?.usageMetadata?.promptTokenCount ?? '?'} in / ${body?.usageMetadata?.candidatesTokenCount ?? '?'} out tokens, ${body?.modelVersion ?? model}, ${finishReason ?? body?.promptFeedback?.blockReason}`,
  );
  if (body?.promptFeedback?.blockReason || (finishReason && DECLINED.includes(finishReason))) {
    return { result: { ok: false, error: 'refused' } };
  }
  if (finishReason !== 'STOP') return { unavailable: `${model} stopped with ${finishReason ?? 'no reason'}` };

  // The answer's text, leaving out any thinking the model shows.
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  const result = readSuggestions(text);
  return result.ok ? { result } : { unavailable: `${model}: ${result.detail}` };
}

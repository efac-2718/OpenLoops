/**
 * Server-only: suggestions from Google's Gemini, on the Gemini API's free tier.
 * The API key is the GEMINI_API_KEY environment variable on EAS Hosting and
 * never reaches the app.
 *
 * This calls the REST API with fetch rather than Google's SDK: through the SDK,
 * requests from EAS Hosting hung until the platform's 100-second limit. A plain
 * request with its own time limit keeps every answer, or failure, quick.
 */

import type { SortRequest } from '@/domain/ai-sort';

import {
  describeFailure,
  readSuggestions,
  SUGGESTIONS_SCHEMA,
  SYSTEM_PROMPT,
  type SuggestResult,
} from './sort-prompt';

// Google's alias for its newest Flash model, which the free tier covers.
const MODEL = 'gemini-flash-latest';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 45_000;

const DECLINED = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'];

type GeminiResponse = {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
  error?: { message?: string; status?: string };
};

export async function suggestWithGemini(request: SortRequest, apiKey: string | undefined): Promise<SuggestResult> {
  if (!apiKey) return { ok: false, error: 'not_configured' };

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let status: number;
  let body: GeminiResponse | null;
  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SUGGESTIONS_SCHEMA },
      }),
      signal: abort.signal,
    });
    status = response.status;
    body = (await response.json().catch(() => null)) as GeminiResponse | null;
  } catch (error) {
    if (abort.signal.aborted) {
      return { ok: false, error: 'busy', detail: `Gemini didn’t answer within ${TIMEOUT_MS / 1000} seconds.` };
    }
    console.error('AI sorting: the request to Gemini failed.', error);
    return { ok: false, error: 'failed', detail: `Gemini: ${describeFailure(error, apiKey)}` };
  } finally {
    clearTimeout(timer);
  }

  if (status !== 200) {
    const message = body?.error?.message ?? '';
    const detail = `Gemini ${status}: ${message}`.slice(0, 300);
    // A wrong key comes back as a 400 that names it; a missing permission as 401 or 403.
    if (status === 401 || status === 403 || (status === 400 && /API key/i.test(message))) {
      console.error('AI sorting: the Gemini API key was rejected.');
      return { ok: false, error: 'not_configured', detail };
    }
    // The free tier's per-minute and daily limits.
    if (status === 429) return { ok: false, error: 'busy', detail };
    console.error(`AI sorting: ${detail}`);
    return { ok: false, error: 'failed', detail };
  }

  const candidate = body?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  // Counts only, never the loops themselves.
  console.info(
    `AI sorting: ${request.loops.length} loops, ${body?.usageMetadata?.promptTokenCount ?? '?'} in / ${body?.usageMetadata?.candidatesTokenCount ?? '?'} out tokens, ${body?.modelVersion ?? MODEL}, ${finishReason ?? body?.promptFeedback?.blockReason}`,
  );
  if (body?.promptFeedback?.blockReason || (finishReason && DECLINED.includes(finishReason))) {
    return { ok: false, error: 'refused' };
  }
  if (finishReason !== 'STOP') {
    return { ok: false, error: 'failed', detail: `Gemini stopped with ${finishReason ?? 'no reason'}.` };
  }

  // The answer's text, leaving out any thinking the model shows.
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  return readSuggestions(text);
}

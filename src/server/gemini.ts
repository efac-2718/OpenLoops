/**
 * Server-only: suggestions from Google's Gemini, on the Gemini API's free tier.
 * The API key is the GEMINI_API_KEY environment variable on EAS Hosting and
 * never reaches the app. Uses the SDK's fetch-only web build, which runs on EAS
 * Hosting without the Google Cloud libraries the Node build pulls in.
 */

import { ApiError, FinishReason, GoogleGenAI } from '@google/genai/web';

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

const DECLINED: (FinishReason | undefined)[] = [
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
];

export async function suggestWithGemini(request: SortRequest, apiKey: string | undefined): Promise<SuggestResult> {
  if (!apiKey) return { ok: false, error: 'not_configured' };
  const ai = new GoogleGenAI({ apiKey });

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: JSON.stringify(request),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: SUGGESTIONS_SCHEMA,
      },
    });
  } catch (error) {
    // A wrong key comes back as a 400 naming API_KEY_INVALID, the only way to tell it apart.
    const badKey = error instanceof ApiError && error.status === 400 && error.message.includes('API_KEY_INVALID');
    if (badKey || (error instanceof ApiError && (error.status === 401 || error.status === 403))) {
      console.error('AI sorting: the Gemini API key was rejected.');
      return { ok: false, error: 'not_configured' };
    }
    // The free tier's per-minute and daily limits.
    if (error instanceof ApiError && error.status === 429) return { ok: false, error: 'busy' };
    console.error('AI sorting: the request to Gemini failed.', error);
    return { ok: false, error: 'failed', detail: `Gemini: ${describeFailure(error, apiKey)}` };
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  const usage = response.usageMetadata;
  // Counts only, never the loops themselves.
  console.info(
    `AI sorting: ${request.loops.length} loops, ${usage?.promptTokenCount ?? '?'} in / ${usage?.candidatesTokenCount ?? '?'} out tokens, ${response.modelVersion ?? MODEL}, ${finishReason ?? response.promptFeedback?.blockReason}`,
  );
  if (response.promptFeedback?.blockReason || DECLINED.includes(finishReason)) {
    return { ok: false, error: 'refused' };
  }
  if (finishReason !== FinishReason.STOP) {
    return { ok: false, error: 'failed', detail: `Gemini stopped with ${finishReason ?? 'no reason'}.` };
  }

  return readSuggestions(response.text);
}

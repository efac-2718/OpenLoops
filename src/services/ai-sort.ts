/** Asks the AI server for suggested decisions. The answer is checked by parseSuggestions. */

import { AI_SERVER_ORIGIN } from '@/constants/ai';
import type { SortRequest } from '@/domain/ai-sort';

export type AiSortError = 'unavailable' | 'offline' | 'not_configured' | 'busy' | 'refused' | 'failed';

/** A failure carries a short technical detail, shown under the message to help diagnose it. */
export type FetchResult =
  | { ok: true; value: unknown }
  | { ok: false; error: AiSortError; detail?: string };

const SERVER_ERRORS: AiSortError[] = ['not_configured', 'busy', 'refused', 'failed'];
const TIMEOUT_MS = 120_000;

export async function fetchSuggestions(request: SortRequest): Promise<FetchResult> {
  if (!AI_SERVER_ORIGIN) return { ok: false, error: 'unavailable' };

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${AI_SERVER_ORIGIN}/api/sort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: abort.signal,
    });
  } catch (error) {
    return { ok: false, error: 'offline', detail: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, value: body };
  const { error, detail } = (body ?? {}) as { error?: AiSortError; detail?: string };
  return {
    ok: false,
    error: error && SERVER_ERRORS.includes(error) ? error : 'failed',
    detail: detail ?? `The server answered HTTP ${response.status}.`,
  };
}

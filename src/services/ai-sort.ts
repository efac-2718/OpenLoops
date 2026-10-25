/** Asks the AI server for suggested decisions. The answer is checked by parseSuggestions. */

import { AI_SERVER_ORIGIN } from '@/constants/ai';
import type { SortRequest } from '@/domain/ai-sort';
import type { Result } from '@/domain/loop';

export type AiSortError = 'unavailable' | 'offline' | 'not_configured' | 'busy' | 'refused' | 'failed';

const SERVER_ERRORS: AiSortError[] = ['not_configured', 'busy', 'refused', 'failed'];
const TIMEOUT_MS = 120_000;

export async function fetchSuggestions(request: SortRequest): Promise<Result<unknown, AiSortError>> {
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
  } catch {
    return { ok: false, error: 'offline' };
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, value: body };
  const error = (body as { error?: AiSortError } | null)?.error;
  return { ok: false, error: error && SERVER_ERRORS.includes(error) ? error : 'failed' };
}

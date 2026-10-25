/**
 * Calls the AI server (src/app/api on EAS Hosting). Each feature checks what
 * comes back with its own reader in src/domain (parseSuggestions, readConcrete,
 * readSplit).
 */

import { AI_SERVER_ORIGIN } from '@/constants/ai';

export type AiCallError = 'unavailable' | 'offline' | 'not_configured' | 'busy' | 'refused' | 'failed';

/** A failure carries a short technical detail, shown under the message to help diagnose it. */
export type AiCallResult =
  | { ok: true; value: unknown }
  | { ok: false; error: AiCallError; detail?: string };

const SERVER_ERRORS: AiCallError[] = ['not_configured', 'busy', 'refused', 'failed'];
// The server gives each AI model 25 seconds and tries up to three.
const TIMEOUT_MS = 120_000;

export async function callAi(path: 'sort' | 'concrete' | 'split', body: unknown): Promise<AiCallResult> {
  if (!AI_SERVER_ORIGIN) return { ok: false, error: 'unavailable' };

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${AI_SERVER_ORIGIN}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  } catch (error) {
    return { ok: false, error: 'offline', detail: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }

  const answer: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, value: answer };
  const { error, detail } = (answer ?? {}) as { error?: AiCallError; detail?: string };
  return {
    ok: false,
    error: error && SERVER_ERRORS.includes(error) ? error : 'failed',
    detail: detail ?? `The server answered HTTP ${response.status}.`,
  };
}

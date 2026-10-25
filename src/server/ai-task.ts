/**
 * Server-only: what an AI feature asks for, and what comes back. Each feature
 * (src/server/tasks) is a prompt, a JSON schema for the answer, and a check of
 * that answer; gemini.ts and claude.ts can run any of them.
 */

export type AiTask<T> = {
  /** Which feature asked, for the logs. */
  name: string;
  /** How many things were sent, for the logs (never their content). */
  size: number;
  system: string;
  input: string;
  schema: object;
  /** Checks the answer and returns what the app gets, or null when it isn't usable. */
  read: (answer: unknown) => T | null;
};

export type AiError = 'not_configured' | 'busy' | 'refused' | 'failed';

/** A failure can carry a short technical detail, passed to the app so a problem can be diagnosed from the phone. */
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiError; detail?: string };

/** One line describing an error, with the API key blanked out in case it ever appears. */
export function describeFailure(error: unknown, apiKey: string): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.split(apiKey).join('[key]').replace(/\s+/g, ' ').slice(0, 300);
}

/** Parses a JSON answer and checks it with the task's reader; null if either fails. */
export function readAnswer<T>(task: AiTask<T>, text: string | undefined): T | null {
  try {
    return task.read(JSON.parse(text ?? ''));
  } catch {
    return null;
  }
}

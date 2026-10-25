/** Server-only: the shared shape of the AI routes in src/app/api. */

import type { Result } from '@/domain/loop';

import type { AiError, AiTask } from './ai-task';
import { askAi } from './ai-service';

const MAX_BODY_BYTES = 200_000;

const STATUS: Record<AiError, number> = {
  not_configured: 503,
  busy: 429,
  refused: 422,
  failed: 502,
};

const error = (code: string, status: number, detail?: string) =>
  Response.json(detail ? { error: code, detail } : { error: code }, { status });

/** Checks the request body, runs the AI task built from it, and answers with its result. */
export async function runAiRoute<R, T>(
  request: Request,
  validate: (body: unknown) => Result<R, 'invalid'>,
  makeTask: (input: R) => AiTask<T>,
): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return error('invalid_request', 413);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('invalid_request', 400);
  }
  const input = validate(body);
  if (!input.ok) return error('invalid_request', 400);

  const result = await askAi(makeTask(input.value));
  if (!result.ok) return error(result.error, STATUS[result.error], result.detail);
  return Response.json(result.value);
}

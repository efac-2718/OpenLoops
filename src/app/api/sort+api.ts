// POST /api/sort: suggested decisions for inbox loops. Runs on EAS Hosting (see app.config.js).

import { validateSortRequest } from '@/domain/ai-sort';
import { suggestDecisions, type SuggestError } from '@/server/suggest-decisions';

const MAX_BODY_BYTES = 200_000;

const STATUS: Record<SuggestError, number> = {
  not_configured: 503,
  busy: 429,
  refused: 422,
  failed: 502,
};

const error = (code: string, status: number) => Response.json({ error: code }, { status });

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return error('invalid_request', 413);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('invalid_request', 400);
  }
  const parsed = validateSortRequest(body);
  if (!parsed.ok) return error('invalid_request', 400);

  const result = await suggestDecisions(parsed.value, process.env.ANTHROPIC_API_KEY);
  if (!result.ok) return error(result.error, STATUS[result.error]);
  return Response.json(result.value);
}

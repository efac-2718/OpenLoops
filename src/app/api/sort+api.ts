// POST /api/sort: a suggested decision for each inbox loop. Runs on EAS Hosting (see app.config.js).

import { validateSortRequest } from '@/domain/ai-sort';
import { runAiRoute } from '@/server/respond';
import { sortTask } from '@/server/tasks/sort';

export function POST(request: Request) {
  return runAiRoute(request, validateSortRequest, sortTask);
}

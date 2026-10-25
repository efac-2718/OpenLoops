// POST /api/split: everything said at once, turned into separate loops. Runs on EAS Hosting.

import { validateSplitRequest } from '@/domain/ai-split';
import { runAiRoute } from '@/server/respond';
import { splitTask } from '@/server/tasks/split';

export function POST(request: Request) {
  return runAiRoute(request, validateSplitRequest, splitTask);
}

// POST /api/concrete: a vague next action rewritten as one physical step. Runs on EAS Hosting.

import { validateConcreteRequest } from '@/domain/ai-concrete';
import { runAiRoute } from '@/server/respond';
import { concreteTask } from '@/server/tasks/concrete';

export function POST(request: Request) {
  return runAiRoute(request, validateConcreteRequest, concreteTask);
}

/**
 * Server-only: runs an AI task on the service the app is set up for
 * (AI_PROVIDER), with that service's key. Used by the routes in src/app/api,
 * which run on EAS Hosting. Never import this from app code.
 */

import { AI_PROVIDER } from '@/constants/ai';

import type { AiResult, AiTask } from './ai-task';
import { askClaude } from './claude';
import { askGemini } from './gemini';

export function askAi<T>(task: AiTask<T>): Promise<AiResult<T>> {
  return AI_PROVIDER === 'claude'
    ? askClaude(task, process.env.ANTHROPIC_API_KEY)
    : askGemini(task, process.env.GEMINI_API_KEY);
}

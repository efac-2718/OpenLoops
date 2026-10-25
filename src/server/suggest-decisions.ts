/**
 * Server-only: asks the AI service the app is set up for (AI_PROVIDER) for a
 * suggested decision per inbox loop. Imported by src/app/api/sort+api.ts, which
 * runs on EAS Hosting. Never import this from app code.
 */

import { AI_PROVIDER } from '@/constants/ai';
import type { SortRequest } from '@/domain/ai-sort';

import { suggestWithClaude } from './claude';
import { suggestWithGemini } from './gemini';
import type { SuggestResult } from './sort-prompt';

export type { SuggestError } from './sort-prompt';

export function suggestDecisions(request: SortRequest): Promise<SuggestResult> {
  return AI_PROVIDER === 'claude'
    ? suggestWithClaude(request, process.env.ANTHROPIC_API_KEY)
    : suggestWithGemini(request, process.env.GEMINI_API_KEY);
}

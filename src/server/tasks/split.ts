/** Server-only: smart brain dump, everything said at once turned into separate loops (POST /api/split). */

import { readSplit, type RawSplit, type SplitRequest } from '@/domain/ai-split';

import type { AiTask } from '../ai-task';

const SCHEMA = {
  type: 'object',
  properties: {
    loops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          words: { type: 'string' },
        },
        required: ['title', 'words'],
        additionalProperties: false,
      },
    },
  },
  required: ['loops'],
  additionalProperties: false,
};

export const SPLIT_PROMPT = `Someone using Open Loops, a Getting Things Done app, said or typed everything on their mind at once, often by dictating. Split it into open loops: one for each separate thing they need to do, decide, find out, or are waiting on, or that is bothering them.

For each loop:
- title: a short title, about eight words at most, that names the thing in their words and their language. Don't add facts, advice or next steps they didn't say.
- words: the part of what they said that it comes from, copied exactly.

Keep everything that matters to them, including worries and feelings (give those a title too); leave out only filler such as "um" or "okay so". Two mentions of the same thing are one loop. Keep the order they said things in.`;

export function splitTask(request: SplitRequest): AiTask<RawSplit> {
  return {
    name: 'split',
    size: 1,
    system: SPLIT_PROMPT,
    input: request.text,
    schema: SCHEMA,
    read: (answer) => (readSplit(answer) ? (answer as RawSplit) : null),
  };
}

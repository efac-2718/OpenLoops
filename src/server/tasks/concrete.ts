/** Server-only: "Make it concrete", a vague next action rewritten as one physical step (POST /api/concrete). */

import { readConcrete, type ConcreteRequest, type RawConcrete } from '@/domain/ai-concrete';

import type { AiTask } from '../ai-task';

const SCHEMA = {
  type: 'object',
  properties: {
    next_action: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['next_action', 'reason'],
  additionalProperties: false,
};

export const CONCRETE_PROMPT = `You help someone using Open Loops, a Getting Things Done app, turn an open loop into a next action they can actually do. You get the loop, its notes, and the next action they have written so far, which may be empty or vague.

Write one next action: a single, visible, physical step that starts with a verb, can be done in one sitting, and is specific enough that they won't have to work out what it means when they read it later. For example, "Sort out taxes" could become "Find last year's tax return in the accountant's email". Keep their intent and their details. If what they wrote is already a concrete step, keep it and only tighten the wording. Don't invent names, places, numbers or dates: say "the accountant" rather than making up a name. Write in the language they used.

The reason is one short sentence on why this is a good first step.`;

export function concreteTask(request: ConcreteRequest): AiTask<RawConcrete> {
  return {
    name: 'concrete',
    size: 1,
    system: CONCRETE_PROMPT,
    input: JSON.stringify({ loop: request.title, notes: request.notes, next_action_so_far: request.nextAction }),
    schema: SCHEMA,
    read: (answer) => (readConcrete(answer) ? (answer as RawConcrete) : null),
  };
}

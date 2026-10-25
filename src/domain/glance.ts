/**
 * The at-a-glance summary for the home-screen widget: what's waiting for a
 * decision, what's due, and whether today has been closed.
 */

import { attentionReason, type Loop } from './loop';

export type Glance = {
  /** Loops still in the inbox. */
  inbox: number;
  /** Scheduled loops due today or overdue. */
  due: number;
  closedToday: boolean;
};

export function glance(loops: Loop[], closedToday: boolean, now: Date): Glance {
  let inbox = 0;
  let due = 0;
  for (const loop of loops) {
    const reason = attentionReason(loop, now);
    if (reason === 'undecided') inbox += 1;
    if (reason === 'due_today' || reason === 'overdue') due += 1;
  }
  return { inbox, due, closedToday };
}

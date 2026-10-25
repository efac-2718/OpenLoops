/**
 * The rules of the app, as plain functions with no React and no database.
 *
 * A loop is anything the user's mind is holding as unfinished. It is captured
 * into the inbox and must leave it with a decision: do it now, give it a next
 * action, schedule it, delegate it, keep thinking on purpose, or drop it.
 */

import { addDays, startOfDay } from './dates';

export const LOOP_STATES = [
  'inbox',
  'next',
  'scheduled',
  'waiting',
  'thinking',
  'done',
  'dropped',
] as const;
export type LoopState = (typeof LOOP_STATES)[number];

/** States that count against the active-loop cap. */
export const ACTIVE_STATES: readonly LoopState[] = ['next', 'scheduled', 'waiting'];
const CLOSED_STATES: readonly LoopState[] = ['done', 'dropped'];

export const DEFAULT_ACTIVE_CAP = 7;

export type Loop = {
  id: string;
  title: string;
  notes: string | null;
  state: LoopState;
  nextAction: string | null;
  dueAt: Date | null;
  waitingOn: string | null;
  revisitAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  deletedAt: Date | null;
};

export type Decision =
  | { kind: 'done' }
  | { kind: 'next'; nextAction: string }
  | { kind: 'scheduled'; nextAction: string; dueAt: Date }
  | { kind: 'waiting'; waitingOn: string }
  | { kind: 'thinking'; revisitAt: Date }
  | { kind: 'dropped' };

export type DecisionKind = Decision['kind'];

export type CaptureError = 'empty_title';

export type DecisionError =
  | 'already_closed'
  | 'missing_next_action'
  | 'missing_waiting_on'
  | 'date_in_past'
  | 'active_cap_reached';

/**
 * The fields a decision writes. Every decision sets all of them, so nothing
 * from a previous state survives (a loop moved to "thinking" has no due date).
 */
export type DecisionChanges = Pick<
  Loop,
  'state' | 'nextAction' | 'dueAt' | 'waitingOn' | 'revisitAt' | 'closedAt' | 'updatedAt'
>;

export type DecisionContext = {
  now: Date;
  /** Active loops right now, including this one if it is already active. */
  activeCount: number;
  activeCap: number;
};

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const fail = <E>(error: E): { ok: false; error: E } => ({ ok: false, error });

export function isActive(state: LoopState): boolean {
  return ACTIVE_STATES.includes(state);
}

export function isClosed(state: LoopState): boolean {
  return CLOSED_STATES.includes(state);
}

export function captureLoop(
  title: string,
  { id, now }: { id: string; now: Date },
): Result<Loop, CaptureError> {
  const trimmed = title.trim();
  if (!trimmed) return fail('empty_title');

  return ok({
    id,
    title: trimmed,
    notes: null,
    state: 'inbox',
    nextAction: null,
    dueAt: null,
    waitingOn: null,
    revisitAt: null,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    deletedAt: null,
  });
}

export function decide(
  loop: Pick<Loop, 'state'>,
  decision: Decision,
  { now, activeCount, activeCap }: DecisionContext,
): Result<DecisionChanges, DecisionError> {
  if (isClosed(loop.state)) return fail('already_closed');

  const today = startOfDay(now);
  const cleared: DecisionChanges = {
    state: decision.kind,
    nextAction: null,
    dueAt: null,
    waitingOn: null,
    revisitAt: null,
    closedAt: null,
    updatedAt: now,
  };
  // Moving between active states doesn't change the count, so only check the cap on the way in.
  const overCap = () => !isActive(loop.state) && activeCount >= activeCap;

  switch (decision.kind) {
    case 'done':
    case 'dropped':
      return ok({ ...cleared, closedAt: now });

    case 'next': {
      const nextAction = decision.nextAction.trim();
      if (!nextAction) return fail('missing_next_action');
      if (overCap()) return fail('active_cap_reached');
      return ok({ ...cleared, nextAction });
    }

    case 'scheduled': {
      const nextAction = decision.nextAction.trim();
      if (!nextAction) return fail('missing_next_action');
      if (decision.dueAt < today) return fail('date_in_past');
      if (overCap()) return fail('active_cap_reached');
      return ok({ ...cleared, nextAction, dueAt: startOfDay(decision.dueAt) });
    }

    case 'waiting': {
      const waitingOn = decision.waitingOn.trim();
      if (!waitingOn) return fail('missing_waiting_on');
      if (overCap()) return fail('active_cap_reached');
      return ok({ ...cleared, waitingOn });
    }

    case 'thinking': {
      if (decision.revisitAt < today) return fail('date_in_past');
      return ok({ ...cleared, revisitAt: startOfDay(decision.revisitAt) });
    }
  }
}

/**
 * Whether tonight's close should ask about this loop: it is still undecided,
 * its scheduled day has come, or it is time to revisit something left open on purpose.
 */
export function needsAttention(loop: Loop, now: Date): boolean {
  if (loop.deletedAt) return false;
  const tomorrow = addDays(startOfDay(now), 1);

  switch (loop.state) {
    case 'inbox':
      return true;
    case 'scheduled':
      return loop.dueAt !== null && loop.dueAt < tomorrow;
    case 'thinking':
      return loop.revisitAt !== null && loop.revisitAt < tomorrow;
    default:
      return false;
  }
}

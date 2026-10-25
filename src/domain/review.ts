/**
 * The weekly review: a guided pass over every open loop so the system stays
 * trustworthy. Each step asks about the loops in one state that haven't been
 * looked at since the review started, so a review can be interrupted and resumed.
 */

import { addDays, startOfDay } from './dates';
import { attentionReason, isClosed, type Loop, type LoopState, type Result } from './loop';

export const REVIEW_STEPS = ['mind_sweep', 'inbox', 'scheduled', 'next', 'waiting', 'thinking'] as const;
export type ReviewStep = (typeof REVIEW_STEPS)[number];

/** The loop state each step reviews. The mind sweep is for capturing, not reviewing. */
const STEP_STATE: Record<ReviewStep, LoopState | null> = {
  mind_sweep: null,
  inbox: 'inbox',
  scheduled: 'scheduled',
  next: 'next',
  waiting: 'waiting',
  thinking: 'thinking',
};

export const REVIEW_INTERVAL_DAYS = 7;

/**
 * Loops a step still asks about. Inbox loops always need a decision; the
 * others need a look (keep, change, finish, or drop) since the review started.
 */
export function pendingForStep(step: ReviewStep, loops: Loop[], startedAt: Date): Loop[] {
  const state = STEP_STATE[step];
  if (state === null) return [];
  return loops.filter(
    (loop) =>
      loop.state === state &&
      !loop.deletedAt &&
      (state === 'inbox' || loop.reviewedAt === null || loop.reviewedAt < startedAt),
  );
}

/**
 * Where to open a review: at the start if nothing has been looked at yet,
 * otherwise at the first step still asking about something (or the last step,
 * ready to finish).
 */
export function resumeStep(loops: Loop[], startedAt: Date): ReviewStep {
  const started = loops.some((loop) => loop.reviewedAt !== null && loop.reviewedAt >= startedAt);
  if (!started) return 'mind_sweep';
  return (
    REVIEW_STEPS.find((step) => pendingForStep(step, loops, startedAt).length > 0) ??
    REVIEW_STEPS[REVIEW_STEPS.length - 1]
  );
}

/** The review can finish once no step is asking about anything. */
export function canFinishReview(loops: Loop[], startedAt: Date): boolean {
  return REVIEW_STEPS.every((step) => pendingForStep(step, loops, startedAt).length === 0);
}

export type KeepError = 'needs_decision' | 'already_closed';

/**
 * Keeping a loop as it is. Only a loop whose decision still holds can be kept:
 * an inbox loop has no decision yet, and an overdue scheduled loop or a
 * "thinking" loop whose revisit day has come needs a new one.
 */
export function keep(
  loop: Pick<Loop, 'state' | 'dueAt' | 'revisitAt' | 'deletedAt'>,
  now: Date,
): Result<Pick<Loop, 'reviewedAt' | 'updatedAt'>, KeepError> {
  if (isClosed(loop.state)) return { ok: false, error: 'already_closed' };
  if (!canKeep(loop, now)) return { ok: false, error: 'needs_decision' };
  return { ok: true, value: { reviewedAt: now, updatedAt: now } };
}

export function canKeep(
  loop: Pick<Loop, 'state' | 'dueAt' | 'revisitAt' | 'deletedAt'>,
  now: Date,
): boolean {
  switch (loop.state) {
    case 'next':
    case 'waiting':
      return true;
    case 'scheduled':
    case 'thinking':
      return attentionReason(loop, now) === null;
    default:
      return false;
  }
}

/** A review is due a week after the last finished one, or straight away if there hasn't been one. */
export function isReviewDue(lastFinishedAt: Date | null, now: Date): boolean {
  return lastFinishedAt === null || startOfDay(now) >= nextReviewDay(lastFinishedAt);
}

export function nextReviewDay(lastFinishedAt: Date): Date {
  return addDays(startOfDay(lastFinishedAt), REVIEW_INTERVAL_DAYS);
}

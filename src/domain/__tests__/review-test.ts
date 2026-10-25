import type { Loop, LoopState } from '../loop';
import {
  canFinishReview,
  canKeep,
  isReviewDue,
  keep,
  nextReviewDay,
  pendingForStep,
  resumeStep,
} from '../review';

// Sunday 1 November 2026, 10:00: a review started this morning.
const now = new Date(2026, 10, 1, 10, 0);
const startedAt = new Date(2026, 10, 1, 9, 45);
const lastWeek = new Date(2026, 9, 25, 20, 0);
const tomorrow = new Date(2026, 10, 2);
const yesterday = new Date(2026, 9, 31);

let nextId = 0;
function loop(state: LoopState, fields: Partial<Loop> = {}): Loop {
  nextId += 1;
  return {
    id: `loop-${nextId}`,
    title: `Loop ${nextId}`,
    notes: null,
    state,
    nextAction: null,
    dueAt: null,
    waitingOn: null,
    revisitAt: null,
    createdAt: lastWeek,
    updatedAt: lastWeek,
    decidedAt: state === 'inbox' ? null : lastWeek,
    reviewedAt: state === 'inbox' ? null : lastWeek,
    closedAt: null,
    deletedAt: null,
    ...fields,
  };
}

describe('pendingForStep', () => {
  test('asks about loops in the step’s state not looked at since the review started', () => {
    const stale = loop('next');
    const lookedAt = loop('next', { reviewedAt: new Date(2026, 10, 1, 9, 50) });
    const neverLookedAt = loop('next', { reviewedAt: null });
    const otherState = loop('waiting');
    const deleted = loop('next', { deletedAt: yesterday });

    expect(pendingForStep('next', [stale, lookedAt, neverLookedAt, otherState, deleted], startedAt)).toEqual([
      stale,
      neverLookedAt,
    ]);
  });

  test('always asks about inbox loops, however recently they were seen', () => {
    const fresh = loop('inbox', { reviewedAt: now });
    expect(pendingForStep('inbox', [fresh], startedAt)).toEqual([fresh]);
  });

  test('the mind sweep asks about nothing', () => {
    expect(pendingForStep('mind_sweep', [loop('inbox'), loop('next')], startedAt)).toEqual([]);
  });

  test('never asks about closed loops', () => {
    expect(pendingForStep('next', [loop('done'), loop('dropped')], startedAt)).toEqual([]);
  });
});

describe('canFinishReview', () => {
  test('once every step is clear', () => {
    const reviewed = { reviewedAt: new Date(2026, 10, 1, 9, 55) };
    expect(
      canFinishReview([loop('next', reviewed), loop('thinking', reviewed), loop('done')], startedAt),
    ).toBe(true);
  });

  test('not while anything is in the inbox or unreviewed', () => {
    expect(canFinishReview([loop('inbox')], startedAt)).toBe(false);
    expect(canFinishReview([loop('waiting')], startedAt)).toBe(false);
  });
});

describe('keep', () => {
  test('confirms a next action or a wait as it is', () => {
    expect(keep(loop('next'), now)).toEqual({ ok: true, value: { reviewedAt: now, updatedAt: now } });
    expect(keep(loop('waiting'), now).ok).toBe(true);
  });

  test('keeps a scheduled loop only while its day is still ahead', () => {
    expect(canKeep(loop('scheduled', { dueAt: tomorrow }), now)).toBe(true);
    expect(keep(loop('scheduled', { dueAt: yesterday }), now)).toEqual({
      ok: false,
      error: 'needs_decision',
    });
    expect(canKeep(loop('scheduled', { dueAt: new Date(2026, 10, 1) }), now)).toBe(false);
  });

  test('keeps a thinking loop only until its revisit day', () => {
    expect(canKeep(loop('thinking', { revisitAt: tomorrow }), now)).toBe(true);
    expect(canKeep(loop('thinking', { revisitAt: yesterday }), now)).toBe(false);
  });

  test('refuses inbox and closed loops', () => {
    expect(keep(loop('inbox'), now)).toEqual({ ok: false, error: 'needs_decision' });
    expect(keep(loop('done'), now)).toEqual({ ok: false, error: 'already_closed' });
  });
});

describe('isReviewDue', () => {
  test('straight away when there has never been a review', () => {
    expect(isReviewDue(null, now)).toBe(true);
  });

  test('a week of calendar days after the last one, whatever the time of day', () => {
    const lastSundayNight = new Date(2026, 9, 25, 23, 0);
    expect(nextReviewDay(lastSundayNight)).toEqual(new Date(2026, 10, 1));
    expect(isReviewDue(lastSundayNight, new Date(2026, 9, 31, 23, 59))).toBe(false);
    expect(isReviewDue(lastSundayNight, new Date(2026, 10, 1, 0, 1))).toBe(true);
  });
});

describe('resumeStep', () => {
  const reviewed = { reviewedAt: new Date(2026, 10, 1, 9, 55) };

  test('starts at the mind sweep when nothing has been looked at yet', () => {
    expect(resumeStep([loop('inbox'), loop('next')], startedAt)).toBe('mind_sweep');
  });

  test('picks up at the first step still asking about something', () => {
    expect(resumeStep([loop('scheduled', { ...reviewed, dueAt: tomorrow }), loop('waiting')], startedAt)).toBe(
      'waiting',
    );
  });

  test('goes to the last step, ready to finish, when everything has been looked at', () => {
    expect(resumeStep([loop('next', reviewed)], startedAt)).toBe('thinking');
  });
});

import { addDays } from '../dates';
import {
  attentionReason,
  canCloseDay,
  captureLoop,
  decide,
  editLoop,
  needsAttention,
  type DecisionContext,
  type Loop,
  type LoopState,
} from '../loop';

// Wednesday 28 October 2026, 21:30 local time: a typical nightly close.
const now = new Date(2026, 9, 28, 21, 30);
const today = new Date(2026, 9, 28);
const tomorrow = new Date(2026, 9, 29);
const yesterday = new Date(2026, 9, 27);

const roomy: DecisionContext = { now, activeCount: 0, activeCap: 7 };
const atCap: DecisionContext = { now, activeCount: 7, activeCap: 7 };

function makeLoop(state: LoopState, fields: Partial<Loop> = {}): Loop {
  const captured = captureLoop('Reply to the landlord', { id: 'loop-1', now: yesterday });
  if (!captured.ok) throw new Error('fixture failed');
  return { ...captured.value, state, ...fields };
}

describe('captureLoop', () => {
  test('starts in the inbox with the title trimmed', () => {
    const result = captureLoop('  Book dentist  ', { id: 'a', now });
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: 'a',
        title: 'Book dentist',
        state: 'inbox',
        createdAt: now,
        updatedAt: now,
      }),
    });
  });

  test.each(['', '   ', '\n\t'])('rejects an empty title %j', (title) => {
    expect(captureLoop(title, { id: 'a', now })).toEqual({ ok: false, error: 'empty_title' });
  });

  test('can start with notes, trimmed; blank notes are none', () => {
    const withNotes = captureLoop('Fix the bike', { id: 'a', now, notes: ' before the weekend ' });
    expect(withNotes.ok && withNotes.value.notes).toBe('before the weekend');
    const blank = captureLoop('Fix the bike', { id: 'a', now, notes: '  ' });
    expect(blank.ok && blank.value.notes).toBeNull();
  });
});

describe('editLoop', () => {
  test('trims the new title and notes', () => {
    expect(editLoop({ title: '  Reply to the landlord about the leak ', notes: ' Flat 4B \n' }, now)).toEqual({
      ok: true,
      value: { title: 'Reply to the landlord about the leak', notes: 'Flat 4B', updatedAt: now },
    });
  });

  test('blank notes are cleared', () => {
    expect(editLoop({ title: 'Reply', notes: '  \n ' }, now)).toEqual({
      ok: true,
      value: { title: 'Reply', notes: null, updatedAt: now },
    });
  });

  test.each(['', '   ', '\n\t'])('rejects an empty title %j', (title) => {
    expect(editLoop({ title, notes: 'Something' }, now)).toEqual({ ok: false, error: 'empty_title' });
  });
});

describe('decide: leaving the inbox', () => {
  const inbox = makeLoop('inbox');

  test('done closes the loop now', () => {
    expect(decide(inbox, { kind: 'done' }, roomy)).toEqual({
      ok: true,
      value: {
        state: 'done',
        nextAction: null,
        dueAt: null,
        waitingOn: null,
        revisitAt: null,
        closedAt: now,
        updatedAt: now,
        decidedAt: now,
        reviewedAt: now,
      },
    });
  });

  test('dropped is a valid way to close a loop', () => {
    const result = decide(inbox, { kind: 'dropped' }, roomy);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ state: 'dropped', closedAt: now }),
    });
  });

  test('next needs a concrete next action', () => {
    expect(decide(inbox, { kind: 'next', nextAction: '  ' }, roomy)).toEqual({
      ok: false,
      error: 'missing_next_action',
    });
    expect(decide(inbox, { kind: 'next', nextAction: ' Email Sam about rent ' }, roomy)).toEqual({
      ok: true,
      value: expect.objectContaining({ state: 'next', nextAction: 'Email Sam about rent' }),
    });
  });

  test('scheduled needs a next action and a day, stored as that calendar day', () => {
    expect(decide(inbox, { kind: 'scheduled', nextAction: '', dueAt: tomorrow }, roomy)).toEqual({
      ok: false,
      error: 'missing_next_action',
    });

    const result = decide(
      inbox,
      { kind: 'scheduled', nextAction: 'Call the bank', dueAt: new Date(2026, 9, 30, 15, 45) },
      roomy,
    );
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        state: 'scheduled',
        nextAction: 'Call the bank',
        dueAt: new Date(2026, 9, 30),
      }),
    });
  });

  test('scheduled accepts today but not a day that has passed', () => {
    expect(decide(inbox, { kind: 'scheduled', nextAction: 'Pay bill', dueAt: today }, roomy).ok).toBe(
      true,
    );
    expect(decide(inbox, { kind: 'scheduled', nextAction: 'Pay bill', dueAt: yesterday }, roomy)).toEqual({
      ok: false,
      error: 'date_in_past',
    });
  });

  test('waiting needs to say who it is waiting on', () => {
    expect(decide(inbox, { kind: 'waiting', waitingOn: ' ' }, roomy)).toEqual({
      ok: false,
      error: 'missing_waiting_on',
    });
    expect(decide(inbox, { kind: 'waiting', waitingOn: 'Priya' }, roomy)).toEqual({
      ok: true,
      value: expect.objectContaining({ state: 'waiting', waitingOn: 'Priya' }),
    });
  });

  test('thinking needs a revisit day that has not passed', () => {
    expect(decide(inbox, { kind: 'thinking', revisitAt: yesterday }, roomy)).toEqual({
      ok: false,
      error: 'date_in_past',
    });
    expect(decide(inbox, { kind: 'thinking', revisitAt: addDays(today, 7) }, roomy)).toEqual({
      ok: true,
      value: expect.objectContaining({ state: 'thinking', revisitAt: new Date(2026, 10, 4) }),
    });
  });
});

describe('decide: changing an existing decision', () => {
  test('clears fields from the previous state', () => {
    const scheduled = makeLoop('scheduled', { nextAction: 'Call the bank', dueAt: tomorrow });
    const result = decide(scheduled, { kind: 'thinking', revisitAt: tomorrow }, roomy);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ state: 'thinking', nextAction: null, dueAt: null }),
    });
  });

  test.each<LoopState>(['done', 'dropped'])('refuses to re-decide a %s loop', (state) => {
    const closed = makeLoop(state, { closedAt: yesterday });
    expect(decide(closed, { kind: 'next', nextAction: 'Try again' }, roomy)).toEqual({
      ok: false,
      error: 'already_closed',
    });
  });
});

describe('decide: active-loop cap', () => {
  const inbox = makeLoop('inbox');

  test('blocks a new active loop at the cap', () => {
    expect(decide(inbox, { kind: 'next', nextAction: 'Email Sam' }, atCap)).toEqual({
      ok: false,
      error: 'active_cap_reached',
    });
    expect(decide(inbox, { kind: 'waiting', waitingOn: 'Priya' }, atCap)).toEqual({
      ok: false,
      error: 'active_cap_reached',
    });
    expect(
      decide(inbox, { kind: 'scheduled', nextAction: 'Pay bill', dueAt: tomorrow }, atCap),
    ).toEqual({ ok: false, error: 'active_cap_reached' });
  });

  test('allows a new active loop below the cap', () => {
    const belowCap = { ...atCap, activeCount: 6 };
    expect(decide(inbox, { kind: 'next', nextAction: 'Email Sam' }, belowCap).ok).toBe(true);
  });

  test('lets an active loop move to another active state at the cap', () => {
    const next = makeLoop('next', { nextAction: 'Email Sam' });
    expect(
      decide(next, { kind: 'scheduled', nextAction: 'Email Sam', dueAt: tomorrow }, atCap).ok,
    ).toBe(true);
  });

  test('never blocks parking, finishing, or dropping', () => {
    expect(decide(inbox, { kind: 'thinking', revisitAt: tomorrow }, atCap).ok).toBe(true);
    expect(decide(inbox, { kind: 'done' }, atCap).ok).toBe(true);
    expect(decide(inbox, { kind: 'dropped' }, atCap).ok).toBe(true);
  });
});

describe('needsAttention (nightly close)', () => {
  test('asks about every undecided loop', () => {
    expect(needsAttention(makeLoop('inbox'), now)).toBe(true);
  });

  test('asks about scheduled loops due today or overdue, not later ones', () => {
    expect(needsAttention(makeLoop('scheduled', { dueAt: today }), now)).toBe(true);
    expect(needsAttention(makeLoop('scheduled', { dueAt: yesterday }), now)).toBe(true);
    expect(needsAttention(makeLoop('scheduled', { dueAt: tomorrow }), now)).toBe(false);
  });

  test('asks about thinking loops once their revisit day arrives', () => {
    expect(needsAttention(makeLoop('thinking', { revisitAt: today }), now)).toBe(true);
    expect(needsAttention(makeLoop('thinking', { revisitAt: tomorrow }), now)).toBe(false);
  });

  test.each<LoopState>(['next', 'waiting', 'done', 'dropped'])('leaves %s loops alone', (state) => {
    expect(needsAttention(makeLoop(state), now)).toBe(false);
  });

  test('ignores deleted loops', () => {
    expect(needsAttention(makeLoop('inbox', { deletedAt: yesterday }), now)).toBe(false);
  });
});

describe('attentionReason', () => {
  test('names why the close is asking', () => {
    expect(attentionReason(makeLoop('inbox'), now)).toBe('undecided');
    expect(attentionReason(makeLoop('scheduled', { dueAt: today }), now)).toBe('due_today');
    expect(attentionReason(makeLoop('scheduled', { dueAt: yesterday }), now)).toBe('overdue');
    expect(attentionReason(makeLoop('thinking', { revisitAt: yesterday }), now)).toBe('revisit');
    expect(attentionReason(makeLoop('scheduled', { dueAt: tomorrow }), now)).toBeNull();
  });
});

describe('canCloseDay', () => {
  test('is true once every loop has a home', () => {
    const settled = [
      makeLoop('next', { nextAction: 'Email Sam' }),
      makeLoop('scheduled', { dueAt: tomorrow }),
      makeLoop('thinking', { revisitAt: tomorrow }),
      makeLoop('done'),
    ];
    expect(canCloseDay(settled, now)).toBe(true);
    expect(canCloseDay([], now)).toBe(true);
  });

  test('is false while anything still needs a decision', () => {
    expect(canCloseDay([makeLoop('next'), makeLoop('inbox')], now)).toBe(false);
    expect(canCloseDay([makeLoop('scheduled', { dueAt: today })], now)).toBe(false);
  });
});

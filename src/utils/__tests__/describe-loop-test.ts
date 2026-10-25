import { describeDecision, describeSuggestion, formatDay, formatDayInline } from '../describe-loop';

const now = new Date(2026, 9, 28, 21, 30);
const blank = { nextAction: null, dueAt: null, waitingOn: null, revisitAt: null };

describe('formatDay', () => {
  test.each([
    [new Date(2026, 9, 28), 'Today'],
    [new Date(2026, 9, 29, 8), 'Tomorrow'],
    [new Date(2026, 9, 27), 'Yesterday'],
  ])('%s is "%s"', (date, expected) => {
    expect(formatDay(date, now)).toBe(expected);
  });

  test('uses a short date further away', () => {
    expect(formatDay(new Date(2026, 10, 2), now)).not.toMatch(/Today|Tomorrow|Yesterday/);
  });
});

test('formatDayInline lowercases relative days only', () => {
  expect(formatDayInline(new Date(2026, 9, 27), now)).toBe('yesterday');
  expect(formatDayInline(new Date(2026, 10, 2), now)).toBe(formatDay(new Date(2026, 10, 2), now));
});

describe('describeDecision', () => {
  test.each([
    [{ ...blank, state: 'inbox' as const }, 'Not decided yet'],
    [{ ...blank, state: 'next' as const, nextAction: 'Email Sam' }, 'Next: Email Sam'],
    [
      { ...blank, state: 'scheduled' as const, nextAction: 'Call the bank', dueAt: new Date(2026, 9, 29) },
      'Tomorrow: Call the bank',
    ],
    [{ ...blank, state: 'waiting' as const, waitingOn: 'Priya' }, 'Waiting on Priya'],
    [
      { ...blank, state: 'thinking' as const, revisitAt: new Date(2026, 9, 28) },
      'Thinking on it until today',
    ],
    [{ ...blank, state: 'dropped' as const }, 'Dropped'],
  ])('%#: %j', (loop, expected) => {
    expect(describeDecision(loop, now)).toBe(expected);
  });
});

describe('describeSuggestion', () => {
  test.each([
    [{ kind: 'done' as const }, 'Do it now: it takes about two minutes'],
    [{ kind: 'next' as const, nextAction: 'Email Sam' }, 'Next action: Email Sam'],
    [{ kind: 'scheduled' as const, nextAction: 'Call the bank', dueAt: new Date(2026, 9, 29) }, 'Tomorrow: Call the bank'],
    [{ kind: 'waiting' as const, waitingOn: 'Priya' }, 'Delegate: waiting on Priya'],
    [{ kind: 'thinking' as const, revisitAt: new Date(2026, 9, 29) }, 'Think on it until tomorrow'],
    [{ kind: 'dropped' as const }, 'Drop it'],
  ])('%j', (decision, expected) => {
    expect(describeSuggestion(decision, now)).toBe(expected);
  });
});

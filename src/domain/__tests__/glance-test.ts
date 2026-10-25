import { glance } from '../glance';
import type { Loop, LoopState } from '../loop';

const now = new Date(2026, 9, 28, 21, 30);

function loop(state: LoopState, fields: Partial<Loop> = {}): Loop {
  return {
    id: Math.random().toString(),
    title: 'A loop',
    notes: null,
    state,
    nextAction: null,
    dueAt: null,
    waitingOn: null,
    revisitAt: null,
    createdAt: now,
    updatedAt: now,
    decidedAt: null,
    reviewedAt: null,
    closedAt: null,
    deletedAt: null,
    ...fields,
  };
}

test('counts the inbox and what is due today or overdue', () => {
  const loops = [
    loop('inbox'),
    loop('inbox'),
    loop('scheduled', { dueAt: new Date(2026, 9, 28) }),
    loop('scheduled', { dueAt: new Date(2026, 9, 26) }),
    loop('scheduled', { dueAt: new Date(2026, 9, 29) }),
    loop('thinking', { revisitAt: new Date(2026, 9, 28) }),
    loop('next'),
    loop('inbox', { deletedAt: now }),
  ];
  expect(glance(loops, false, now)).toEqual({ inbox: 2, due: 2, closedToday: false });
});

test('passes through whether the day is closed', () => {
  expect(glance([], true, now)).toEqual({ inbox: 0, due: 0, closedToday: true });
});

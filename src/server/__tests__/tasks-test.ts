import { concreteTask } from '../tasks/concrete';
import { sortTask } from '../tasks/sort';
import { splitTask } from '../tasks/split';

const sortRequest = {
  today: '2026-10-28',
  weekday: 'Wednesday',
  activeCount: 3,
  activeCap: 7,
  loops: [{ id: 'a', title: 'Call the bank', notes: null, captured: '2026-10-26' }],
};

describe('sortTask', () => {
  const task = sortTask(sortRequest);

  test('sends the request as JSON and counts its loops', () => {
    expect(JSON.parse(task.input)).toEqual(sortRequest);
    expect(task.size).toBe(1);
  });

  test('accepts an answer with a list of suggestions, and nothing else', () => {
    expect(task.read({ suggestions: [] })).toEqual({ suggestions: [] });
    expect(task.read({})).toBeNull();
  });
});

describe('concreteTask', () => {
  const task = concreteTask({ title: 'Taxes', notes: 'Due in May', nextAction: 'sort out taxes' });

  test('sends the loop, its notes, and the next action so far', () => {
    expect(JSON.parse(task.input)).toEqual({ loop: 'Taxes', notes: 'Due in May', next_action_so_far: 'sort out taxes' });
  });

  test('accepts an answer with a next action', () => {
    const answer = { next_action: 'Find last year’s tax return', reason: 'It starts everything.' };
    expect(task.read(answer)).toEqual(answer);
    expect(task.read({ next_action: ' ', reason: 'x' })).toBeNull();
  });
});

describe('splitTask', () => {
  const task = splitTask({ text: 'Call mum and fix the bike' });

  test('sends what was said as it is', () => {
    expect(task.input).toBe('Call mum and fix the bike');
  });

  test('accepts an answer with at least one loop', () => {
    const answer = { loops: [{ title: 'Call mum', words: 'Call mum' }] };
    expect(task.read(answer)).toEqual(answer);
    expect(task.read({ loops: [] })).toBeNull();
  });
});

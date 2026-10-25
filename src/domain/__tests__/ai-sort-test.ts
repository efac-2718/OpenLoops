import {
  buildSortRequest,
  MAX_LOOPS_PER_SORT,
  parseSuggestions,
  readSavedSuggestion,
  validateSortRequest,
  type SortRequest,
} from '../ai-sort';

// Wednesday 28 October 2026, 21:30 local time.
const now = new Date(2026, 9, 28, 21, 30);

const loop = (id: string, fields: { title?: string; notes?: string | null } = {}) => ({
  id,
  title: fields.title ?? `Loop ${id}`,
  notes: fields.notes ?? null,
  createdAt: new Date(2026, 9, 26, 8, 15),
});

const request: SortRequest = {
  today: '2026-10-28',
  weekday: 'Wednesday',
  activeCount: 3,
  activeCap: 7,
  loops: [{ id: 'a', title: 'Call the bank', notes: null, captured: '2026-10-26' }],
};

describe('buildSortRequest', () => {
  test('carries the local day, the active-loop numbers, and each loop', () => {
    expect(
      buildSortRequest([loop('a', { notes: 'About the double charge' })], {
        now,
        activeCount: 3,
        activeCap: 7,
      }),
    ).toEqual({
      today: '2026-10-28',
      weekday: 'Wednesday',
      activeCount: 3,
      activeCap: 7,
      loops: [{ id: 'a', title: 'Loop a', notes: 'About the double charge', captured: '2026-10-26' }],
    });
  });

  test(`covers at most ${MAX_LOOPS_PER_SORT} loops, in the order given`, () => {
    const loops = Array.from({ length: 30 }, (_, index) => loop(String(index)));
    const built = buildSortRequest(loops, { now, activeCount: 0, activeCap: 7 });
    expect(built.loops.map((l) => l.id)).toEqual(loops.slice(0, MAX_LOOPS_PER_SORT).map((l) => l.id));
  });

  test('what it builds passes the server check', () => {
    const built = buildSortRequest([loop('a'), loop('b')], { now, activeCount: 0, activeCap: 7 });
    expect(validateSortRequest(JSON.parse(JSON.stringify(built)))).toEqual({ ok: true, value: built });
  });
});

describe('validateSortRequest', () => {
  test.each([
    ['not an object', 'hello'],
    ['no loops', { ...request, loops: [] }],
    ['too many loops', { ...request, loops: Array(MAX_LOOPS_PER_SORT + 1).fill(request.loops[0]) }],
    ['a made-up day', { ...request, today: '2026-02-30' }],
    ['an unknown weekday', { ...request, weekday: 'Someday' }],
    ['a negative count', { ...request, activeCount: -1 }],
    ['an empty title', { ...request, loops: [{ ...request.loops[0], title: '  ' }] }],
    ['a huge title', { ...request, loops: [{ ...request.loops[0], title: 'x'.repeat(5000) }] }],
    ['notes that are not text', { ...request, loops: [{ ...request.loops[0], notes: 4 }] }],
    ['a missing id', { ...request, loops: [{ ...request.loops[0], id: '' }] }],
  ])('rejects %s', (_, body) => {
    expect(validateSortRequest(body)).toEqual({ ok: false, error: 'invalid' });
  });

  test('keeps only the known fields', () => {
    const result = validateSortRequest({ ...request, extra: 'x', loops: [{ ...request.loops[0], extra: 'y' }] });
    expect(result).toEqual({ ok: true, value: request });
  });
});

describe('parseSuggestions', () => {
  const asked = ['a', 'b', 'c', 'd', 'e', 'f'];
  const suggestion = (fields: Record<string, unknown>) => ({
    next_action: null,
    day: null,
    waiting_on: null,
    reason: 'Because.',
    ...fields,
  });

  test('turns each kind of answer into a decision', () => {
    const answer = {
      suggestions: [
        suggestion({ id: 'a', decision: 'done', reason: ' Two minutes. ' }),
        suggestion({ id: 'b', decision: 'next', next_action: ' Email Sam ' }),
        suggestion({ id: 'c', decision: 'scheduled', next_action: 'Call the bank', day: '2026-10-29' }),
        suggestion({ id: 'd', decision: 'waiting', waiting_on: 'Priya' }),
        suggestion({ id: 'e', decision: 'thinking', day: '2026-11-04' }),
        suggestion({ id: 'f', decision: 'dropped' }),
      ],
    };
    expect(parseSuggestions(answer, asked, now)).toEqual([
      { loopId: 'a', decision: { kind: 'done' }, reason: 'Two minutes.' },
      { loopId: 'b', decision: { kind: 'next', nextAction: 'Email Sam' }, reason: 'Because.' },
      {
        loopId: 'c',
        decision: { kind: 'scheduled', nextAction: 'Call the bank', dueAt: new Date(2026, 9, 29) },
        reason: 'Because.',
      },
      { loopId: 'd', decision: { kind: 'waiting', waitingOn: 'Priya' }, reason: 'Because.' },
      { loopId: 'e', decision: { kind: 'thinking', revisitAt: new Date(2026, 10, 4) }, reason: 'Because.' },
      { loopId: 'f', decision: { kind: 'dropped' }, reason: 'Because.' },
    ]);
  });

  test('today is a valid day', () => {
    const answer = { suggestions: [suggestion({ id: 'a', decision: 'scheduled', next_action: 'Pay rent', day: '2026-10-28' })] };
    expect(parseSuggestions(answer, asked, now)).toHaveLength(1);
  });

  test.each([
    ['an unknown loop', { id: 'z', decision: 'done' }],
    ['an unknown decision', { id: 'a', decision: 'delegate' }],
    ['a next action without the action', { id: 'a', decision: 'next', next_action: '  ' }],
    ['a schedule without a day', { id: 'a', decision: 'scheduled', next_action: 'Call' }],
    ['a schedule in the past', { id: 'a', decision: 'scheduled', next_action: 'Call', day: '2026-10-27' }],
    ['a schedule on a made-up day', { id: 'a', decision: 'scheduled', next_action: 'Call', day: 'Friday' }],
    ['waiting on nobody', { id: 'a', decision: 'waiting' }],
    ['thinking without a day', { id: 'a', decision: 'thinking' }],
  ])('leaves out %s', (_, fields) => {
    expect(parseSuggestions({ suggestions: [suggestion(fields)] }, asked, now)).toEqual([]);
  });

  test('keeps the first suggestion when a loop gets two', () => {
    const answer = {
      suggestions: [suggestion({ id: 'a', decision: 'done' }), suggestion({ id: 'a', decision: 'dropped' })],
    };
    expect(parseSuggestions(answer, asked, now)).toEqual([
      { loopId: 'a', decision: { kind: 'done' }, reason: 'Because.' },
    ]);
  });

  test.each([null, 'text', {}, { suggestions: 'no' }])('reads %j as no suggestions', (answer) => {
    expect(parseSuggestions(answer, asked, now)).toEqual([]);
  });
});

describe('readSavedSuggestion', () => {
  const loop = { id: 'a', updatedAt: new Date(2026, 9, 26, 9) };
  const saved = (answer: object, loopUpdatedAt = loop.updatedAt) => ({
    loopId: 'a',
    answer: JSON.stringify({ id: 'a', next_action: null, day: null, waiting_on: null, reason: 'Why.', ...answer }),
    loopUpdatedAt,
  });

  test('reads a saved suggestion back for the same version of the loop', () => {
    expect(readSavedSuggestion(saved({ decision: 'next', next_action: 'Email Sam' }), loop, now)).toEqual({
      loopId: 'a',
      decision: { kind: 'next', nextAction: 'Email Sam' },
      reason: 'Why.',
    });
  });

  test('drops it once the loop has been edited', () => {
    const edited = { ...loop, updatedAt: new Date(2026, 9, 27) };
    expect(readSavedSuggestion(saved({ decision: 'done' }), edited, now)).toBeNull();
  });

  test('drops a suggested day that has since passed', () => {
    const old = saved({ decision: 'thinking', day: '2026-10-27' });
    expect(readSavedSuggestion(old, loop, now)).toBeNull();
  });

  test('drops a damaged or mismatched record', () => {
    expect(readSavedSuggestion(undefined, loop, now)).toBeNull();
    expect(readSavedSuggestion({ ...saved({ decision: 'done' }), answer: '{' }, loop, now)).toBeNull();
    expect(readSavedSuggestion({ ...saved({ decision: 'done' }), loopId: 'b' }, loop, now)).toBeNull();
  });
});

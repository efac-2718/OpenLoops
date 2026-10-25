import { parseBackup, planMerge } from '../backup';
import { toJson, type ExportData } from '../export';
import type { Loop } from '../loop';

const day = (d: number, h = 9) => new Date(2026, 9, d, h);
const exportedAt = day(25, 21);

function loop(id: string, fields: Partial<Loop> = {}): Loop {
  return {
    id,
    title: `Loop ${id}`,
    notes: null,
    state: 'next',
    nextAction: 'Do the thing',
    dueAt: null,
    waitingOn: null,
    revisitAt: null,
    createdAt: day(20),
    updatedAt: day(21),
    decidedAt: day(21),
    reviewedAt: day(21),
    closedAt: null,
    deletedAt: null,
    ...fields,
  };
}

const data: ExportData = {
  loops: [loop('a'), loop('b', { state: 'scheduled', dueAt: day(27, 0) })],
  dailyCloses: [{ id: 'c1', day: '2026-10-24', resolvedCount: 3, createdAt: day(24), updatedAt: day(24) }],
  weeklyReviews: [
    { id: 'r1', startedAt: day(25), completedAt: day(25, 10), reviewedCount: 6, createdAt: day(25), updatedAt: day(25, 10) },
  ],
  settings: [{ key: 'active_cap', value: '5', updatedAt: day(20) }],
};

describe('parseBackup', () => {
  test('reads back exactly what Export wrote', () => {
    expect(parseBackup(toJson(data, exportedAt))).toEqual({
      ok: true,
      value: { ...data, exportedAt },
    });
  });

  test('accepts a backup from before weekly reviews existed', () => {
    const old = JSON.parse(toJson(data, exportedAt));
    delete old.weeklyReviews;
    for (const row of old.loops) {
      delete row.decidedAt;
      delete row.reviewedAt;
    }
    const result = parseBackup(JSON.stringify(old));
    expect(result.ok && result.value.weeklyReviews).toEqual([]);
    expect(result.ok && result.value.loops[0].decidedAt).toBeNull();
  });

  test.each([
    ['not JSON', 'Hello', 'not_json'],
    ['another app’s file', JSON.stringify({ app: 'Todo', loops: [] }), 'not_open_loops'],
    ['a list', '[]', 'not_open_loops'],
    ['a newer format', JSON.stringify({ app: 'Open Loops', formatVersion: 2, loops: [] }), 'newer_version'],
  ])('rejects %s', (_, text, error) => {
    expect(parseBackup(text)).toEqual({ ok: false, error });
  });

  test.each([
    ['an unknown state', { state: 'someday' }],
    ['a missing title', { title: '' }],
    ['a broken date', { createdAt: 'yesterday' }],
    ['a missing id', { id: null }],
  ])('rejects a loop with %s, changing nothing', (_, broken) => {
    const file = JSON.parse(toJson(data, exportedAt));
    Object.assign(file.loops[1], broken);
    expect(parseBackup(JSON.stringify(file))).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('planMerge', () => {
  const byId = (row: { id: string }) => row.id;

  test('adds new rows, takes newer ones, and leaves the rest', () => {
    const current = [loop('same'), loop('older-here'), loop('newer-here', { updatedAt: day(24) })];
    const incoming = [
      loop('same'),
      loop('older-here', { updatedAt: day(23), title: 'Changed later' }),
      loop('newer-here', { updatedAt: day(22) }),
      loop('new'),
    ];
    const plan = planMerge(current, incoming, byId);
    expect(plan.insert.map(byId)).toEqual(['new']);
    expect(plan.update.map((row) => row.title)).toEqual(['Changed later']);
    expect(plan.unchanged).toBe(2);
  });

  test('keeps a deletion made after the backup', () => {
    const deletedHere = loop('a', { deletedAt: day(24), updatedAt: day(24) });
    expect(planMerge([deletedHere], [loop('a')], byId)).toEqual({ insert: [], update: [], unchanged: 1 });
  });

  test('restoring twice changes nothing the second time', () => {
    const incoming = [loop('a', { updatedAt: day(23) }), loop('new')];
    const first = planMerge([loop('a')], incoming, byId);
    const afterFirst = [...first.update, ...first.insert];
    expect(planMerge(afterFirst, incoming, byId)).toEqual({ insert: [], update: [], unchanged: 2 });
  });
});

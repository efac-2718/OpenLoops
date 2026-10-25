import { exportFileName, toJson, toMarkdown, type ExportData } from '../export';
import type { Loop, LoopState } from '../loop';

const now = new Date(2026, 9, 25, 21, 30);
const day = (d: number) => new Date(2026, 9, d);

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
    createdAt: day(20),
    updatedAt: day(20),
    decidedAt: null,
    reviewedAt: null,
    closedAt: null,
    deletedAt: null,
    ...fields,
  };
}

test('file names carry the export day', () => {
  expect(exportFileName('md', now)).toBe('open-loops-2026-10-25.md');
  expect(exportFileName('json', now)).toBe('open-loops-2026-10-25.json');
});

describe('toMarkdown', () => {
  test('groups loops by decision, in a fixed order, leaving out empty groups', () => {
    const markdown = toMarkdown(
      [
        loop('dropped', { title: 'Old gym plan', closedAt: day(24) }),
        loop('waiting', { title: 'Q3 numbers', waitingOn: 'Priya' }),
        loop('scheduled', { title: 'Passport', nextAction: 'Book photo', dueAt: day(27) }),
        loop('scheduled', { title: 'Bank', nextAction: 'Call the bank', dueAt: day(26) }),
        loop('inbox', { title: 'Gym membership' }),
        loop('thinking', { title: 'Nightly ritual idea', revisitAt: day(28) }),
      ],
      now,
    );

    expect(markdown).toBe(
      [
        '# Open Loops',
        '',
        'Exported 2026-10-25.',
        '',
        '## Inbox (1)',
        '',
        '- Gym membership',
        '',
        '## Scheduled (2)',
        '',
        '- 2026-10-26: Call the bank (Bank)',
        '- 2026-10-27: Book photo (Passport)',
        '',
        '## Waiting on someone (1)',
        '',
        '- Q3 numbers, waiting on Priya',
        '',
        '## Thinking on this (1)',
        '',
        '- Nightly ritual idea, revisit 2026-10-28',
        '',
        '## Dropped (1)',
        '',
        '- Old gym plan (2026-10-24)',
        '',
      ].join('\n'),
    );
  });

  test('keeps a multi-line capture on one list item', () => {
    expect(toMarkdown([loop('inbox', { title: 'Call mum\n  about Sunday' })], now)).toContain(
      '- Call mum about Sunday\n',
    );
  });

  test('quotes notes under their loop, line by line', () => {
    expect(
      toMarkdown([loop('inbox', { title: 'Leak', notes: 'Flat 4B\n\nAsk for the plumber’s number' })], now),
    ).toContain('- Leak\n  > Flat 4B\n  >\n  > Ask for the plumber’s number\n');
  });

  test('leaves out deleted loops and says when there is nothing', () => {
    expect(toMarkdown([loop('inbox', { deletedAt: day(24) })], now)).toBe(
      '# Open Loops\n\nExported 2026-10-25.\n\nNothing here yet.\n',
    );
  });
});

describe('toJson', () => {
  test('includes everything, versioned, with ISO dates', () => {
    const data: ExportData = {
      loops: [loop('next', { nextAction: 'Email Sam' })],
      dailyCloses: [
        { id: 'c1', day: '2026-10-24', resolvedCount: 3, createdAt: day(24), updatedAt: day(24) },
      ],
      weeklyReviews: [
        {
          id: 'r1',
          startedAt: day(25),
          completedAt: day(25),
          reviewedCount: 6,
          createdAt: day(25),
          updatedAt: day(25),
        },
      ],
      settings: [{ key: 'active_cap', value: '5', updatedAt: day(20) }],
    };
    const parsed = JSON.parse(toJson(data, now));

    expect(parsed).toMatchObject({
      app: 'Open Loops',
      formatVersion: 1,
      exportedAt: now.toISOString(),
      loops: [{ state: 'next', nextAction: 'Email Sam', createdAt: day(20).toISOString() }],
      dailyCloses: [{ day: '2026-10-24', resolvedCount: 3 }],
      weeklyReviews: [{ id: 'r1', reviewedCount: 6, completedAt: day(25).toISOString() }],
      settings: [{ key: 'active_cap', value: '5' }],
    });
  });
});

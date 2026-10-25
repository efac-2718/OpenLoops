import type { LoopRow } from '@/db/loops';

import {
  clearSuggestions,
  getAiSuggestions as current,
  requestSuggestions,
  suggestionFor,
} from '../use-ai-suggestions';

const mockFetchSuggestions = jest.fn();
jest.mock('@/services/ai-sort', () => ({
  fetchSuggestions: (...args: unknown[]) => mockFetchSuggestions(...args),
}));

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function loop(id: string, updatedAt = new Date(2026, 9, 20)): LoopRow {
  return {
    id,
    title: `Loop ${id}`,
    notes: null,
    state: 'inbox',
    nextAction: null,
    dueAt: null,
    waitingOn: null,
    revisitAt: null,
    createdAt: new Date(2026, 9, 20),
    updatedAt,
    decidedAt: null,
    reviewedAt: null,
    closedAt: null,
    deletedAt: null,
  };
}

const context = { activeCount: 2, activeCap: 7 };

beforeEach(() => {
  clearSuggestions();
  mockFetchSuggestions.mockReset();
});

test('keeps a checked suggestion for each loop that was asked about', async () => {
  mockFetchSuggestions.mockResolvedValue({
    ok: true,
    value: {
      suggestions: [
        { id: 'a', decision: 'next', next_action: 'Email Sam', day: null, waiting_on: null, reason: 'Quick.' },
        { id: 'b', decision: 'scheduled', next_action: 'Call', day: tomorrow(), waiting_on: null, reason: '' },
      ],
    },
  });

  await requestSuggestions([loop('a'), loop('b')], context);

  expect(mockFetchSuggestions.mock.calls[0][0]).toMatchObject({ activeCount: 2, activeCap: 7 });
  const state = current();
  expect(state.status).toBe('done');
  expect(state.received).toBe(2);
  expect(suggestionFor(state, loop('a'))?.decision).toEqual({ kind: 'next', nextAction: 'Email Sam' });
  expect(suggestionFor(state, loop('b'))?.decision.kind).toBe('scheduled');
});

test('stops offering a suggestion once the loop is edited', async () => {
  mockFetchSuggestions.mockResolvedValue({
    ok: true,
    value: { suggestions: [{ id: 'a', decision: 'dropped', next_action: null, day: null, waiting_on: null, reason: '' }] },
  });
  await requestSuggestions([loop('a')], context);

  expect(suggestionFor(current(), loop('a'))).not.toBeNull();
  expect(suggestionFor(current(), loop('a', new Date(2026, 9, 21)))).toBeNull();
});

test('reports a failed request and keeps earlier suggestions', async () => {
  mockFetchSuggestions.mockResolvedValueOnce({
    ok: true,
    value: { suggestions: [{ id: 'a', decision: 'done', next_action: null, day: null, waiting_on: null, reason: '' }] },
  });
  await requestSuggestions([loop('a')], context);
  mockFetchSuggestions.mockResolvedValueOnce({ ok: false, error: 'offline' });
  await requestSuggestions([loop('b')], context);

  const state = current();
  expect(state).toMatchObject({ status: 'error', error: 'offline' });
  expect(suggestionFor(state, loop('a'))).not.toBeNull();
});

test('turning AI suggestions off forgets them', async () => {
  mockFetchSuggestions.mockResolvedValue({
    ok: true,
    value: { suggestions: [{ id: 'a', decision: 'done', next_action: null, day: null, waiting_on: null, reason: '' }] },
  });
  await requestSuggestions([loop('a')], context);
  clearSuggestions();

  expect(current()).toMatchObject({ status: 'idle', received: 0 });
  expect(suggestionFor(current(), loop('a'))).toBeNull();
});

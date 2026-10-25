import type { LoopRow } from '@/db/loops';

import { clearSuggestions, getAiSuggestions as current, requestSuggestions } from '../use-ai-suggestions';

const mockCallAi = jest.fn();
jest.mock('@/services/ai', () => ({ callAi: (...args: unknown[]) => mockCallAi(...args) }));

const mockSaveSuggestions = jest.fn();
const mockClearSavedSuggestions = jest.fn();
jest.mock('@/db/suggestions', () => ({
  saveSuggestions: (...args: unknown[]) => mockSaveSuggestions(...args),
  clearSavedSuggestions: () => mockClearSavedSuggestions(),
  savedSuggestionsQuery: jest.fn(),
}));

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function loop(id: string): LoopRow {
  const at = new Date(2026, 9, 20);
  return {
    id,
    title: `Loop ${id}`,
    notes: null,
    state: 'inbox',
    nextAction: null,
    dueAt: null,
    waitingOn: null,
    revisitAt: null,
    createdAt: at,
    updatedAt: at,
    decidedAt: null,
    reviewedAt: null,
    closedAt: null,
    deletedAt: null,
  };
}

const context = { activeCount: 2, activeCap: 7 };
const a = { id: 'a', decision: 'next', next_action: 'Email Sam', day: null, waiting_on: null, reason: 'Quick.' };
const b = { id: 'b', decision: 'scheduled', next_action: 'Call', day: tomorrow(), waiting_on: null, reason: '' };

beforeEach(() => {
  clearSuggestions();
  mockCallAi.mockReset();
  mockSaveSuggestions.mockReset();
});

test('asks the server to sort the loops, and saves each usable suggestion with its loop', async () => {
  // c has a suggestion without a next action, which isn't a usable decision.
  const c = { ...a, id: 'c', next_action: null };
  mockCallAi.mockResolvedValue({ ok: true, value: { suggestions: [a, b, c] } });

  await requestSuggestions([loop('a'), loop('b'), loop('c')], context);

  expect(mockCallAi).toHaveBeenCalledWith('sort', expect.objectContaining({ activeCount: 2, activeCap: 7 }));
  expect(mockSaveSuggestions).toHaveBeenCalledWith([
    { loop: loop('a'), answer: a },
    { loop: loop('b'), answer: b },
  ]);
  expect(current()).toMatchObject({ status: 'done', received: 2 });
});

test('reports a failed request, with its detail, and saves nothing', async () => {
  mockCallAi.mockResolvedValue({ ok: false, error: 'offline', detail: 'Network request failed' });

  await requestSuggestions([loop('a')], context);

  expect(current()).toMatchObject({ status: 'error', error: 'offline', detail: 'Network request failed' });
  expect(mockSaveSuggestions).not.toHaveBeenCalled();
});

test('turning AI suggestions off forgets the saved ones', () => {
  mockClearSavedSuggestions.mockClear();
  clearSuggestions();
  expect(mockClearSavedSuggestions).toHaveBeenCalled();
  expect(current()).toMatchObject({ status: 'idle', received: 0 });
});

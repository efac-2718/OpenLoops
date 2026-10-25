import { POST as concrete } from '@/app/api/concrete+api';
import { POST as sort } from '@/app/api/sort+api';
import { POST as split } from '@/app/api/split+api';

import type { AiTask } from '../ai-task';

const mockAskAi = jest.fn();
jest.mock('../ai-service', () => ({ askAi: (task: unknown) => mockAskAi(task) }));

const post = (route: (request: Request) => Promise<Response>, body: unknown) =>
  route(new Request('https://example.test/api', { method: 'POST', body: JSON.stringify(body) }));

const sortRequest = {
  today: '2026-10-28',
  weekday: 'Wednesday',
  activeCount: 3,
  activeCap: 7,
  loops: [{ id: 'a', title: 'Call the bank', notes: null, captured: '2026-10-26' }],
};

const lastTask = (): AiTask<unknown> => mockAskAi.mock.calls[0][0];

beforeEach(() => mockAskAi.mockReset());

test.each([
  ['sort', sort, sortRequest],
  ['concrete', concrete, { title: 'Taxes', notes: null, nextAction: 'sort out taxes' }],
  ['split', split, { text: 'Call mum. Fix the bike.' }],
])('/api/%s runs its task and returns the answer', async (name, route, body) => {
  mockAskAi.mockResolvedValue({ ok: true, value: { answer: 'yes' } });

  const response = await post(route, body);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ answer: 'yes' });
  expect(lastTask().name).toBe(name);
});

test.each([
  ['sort', sort, { ...sortRequest, loops: [] }],
  ['concrete', concrete, { title: '', notes: null, nextAction: '' }],
  ['split', split, { text: 'x'.repeat(5000) }],
])('/api/%s refuses a malformed request without asking the AI', async (_, route, body) => {
  const response = await post(route, body);
  expect(response.status).toBe(400);
  expect(mockAskAi).not.toHaveBeenCalled();
});

test.each([
  ['not_configured', 503],
  ['busy', 429],
  ['refused', 422],
  ['failed', 502],
])('passes on %s as HTTP %i, with its detail', async (error, status) => {
  mockAskAi.mockResolvedValue({ ok: false, error, detail: 'Gemini 503: high demand' });
  const response = await post(sort, sortRequest);
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error, detail: 'Gemini 503: high demand' });
});

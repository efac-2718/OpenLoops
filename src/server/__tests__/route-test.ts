import { POST } from '@/app/api/sort+api';
import type { SortRequest } from '@/domain/ai-sort';

const mockSuggestWithGemini = jest.fn();
const mockSuggestWithClaude = jest.fn();
jest.mock('../gemini', () => ({ suggestWithGemini: (...args: unknown[]) => mockSuggestWithGemini(...args) }));
jest.mock('../claude', () => ({ suggestWithClaude: (...args: unknown[]) => mockSuggestWithClaude(...args) }));

const request: SortRequest = {
  today: '2026-10-28',
  weekday: 'Wednesday',
  activeCount: 3,
  activeCap: 7,
  loops: [{ id: 'a', title: 'Call the bank', notes: null, captured: '2026-10-26' }],
};
const suggestions = [
  { id: 'a', decision: 'next', next_action: 'Call the bank', day: null, waiting_on: null, reason: 'Quick call.' },
];

const post = (body: unknown) =>
  POST(new Request('https://example.test/api/sort', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  mockSuggestWithGemini.mockReset();
  mockSuggestWithClaude.mockReset();
  process.env.GEMINI_API_KEY = 'gemini-key';
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

test('asks the configured service (Gemini) with its key, and returns the suggestions', async () => {
  mockSuggestWithGemini.mockResolvedValue({ ok: true, value: { suggestions } });

  const response = await post(request);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ suggestions });
  expect(mockSuggestWithGemini).toHaveBeenCalledWith(request, 'gemini-key');
  expect(mockSuggestWithClaude).not.toHaveBeenCalled();
});

test('refuses a malformed request without asking anyone', async () => {
  const response = await post({ ...request, loops: [] });
  expect(response.status).toBe(400);
  expect(mockSuggestWithGemini).not.toHaveBeenCalled();
});

test.each([
  ['not_configured', 503],
  ['busy', 429],
  ['refused', 422],
  ['failed', 502],
])('passes on %s as HTTP %i', async (error, status) => {
  mockSuggestWithGemini.mockResolvedValue({ ok: false, error });
  const response = await post(request);
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error });
});

test('passes on the detail of a failure', async () => {
  mockSuggestWithGemini.mockResolvedValue({ ok: false, error: 'failed', detail: 'Gemini: Error: not found' });
  const response = await post(request);
  await expect(response.json()).resolves.toEqual({ error: 'failed', detail: 'Gemini: Error: not found' });
});

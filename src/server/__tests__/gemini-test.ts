import type { SortRequest } from '@/domain/ai-sort';

import { suggestWithGemini } from '../gemini';
import { SUGGESTIONS_SCHEMA, SYSTEM_PROMPT } from '../sort-prompt';

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

function answer(fields: Record<string, unknown> = {}) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: { parts: [{ text: 'Thinking it over', thought: true }, { text: JSON.stringify({ suggestions }) }] },
      },
    ],
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 200 },
    modelVersion: 'gemini-flash',
    ...fields,
  };
}

const mockFetch = jest.fn();
const reply = (status: number, body: unknown) => mockFetch.mockResolvedValue({ status, json: async () => body });

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

test('asks Gemini Flash for JSON matching the suggestions schema, and reads the answer', async () => {
  reply(200, answer());

  await expect(suggestWithGemini(request, 'key')).resolves.toEqual({ ok: true, value: { suggestions } });
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-goog-api-key': 'key' });
  expect(JSON.parse(init.body)).toEqual({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SUGGESTIONS_SCHEMA },
  });
});

test('needs an API key', async () => {
  await expect(suggestWithGemini(request, undefined)).resolves.toEqual({ ok: false, error: 'not_configured' });
  expect(mockFetch).not.toHaveBeenCalled();
});

test.each([
  ['a safety stop', answer({ candidates: [{ finishReason: 'SAFETY' }] }), 'refused'],
  ['a blocked prompt', answer({ candidates: [], promptFeedback: { blockReason: 'OTHER' } }), 'refused'],
  ['running out of tokens', answer({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), 'failed'],
  ['text that is not JSON', answer({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Sure!' }] } }] }), 'failed'],
])('reports %s', async (_, body, error) => {
  reply(200, body);
  await expect(suggestWithGemini(request, 'key')).resolves.toMatchObject({ ok: false, error });
});

test.each([
  ['a wrong key', 400, 'API key not valid. Please pass a valid API key.', 'not_configured'],
  ['a rejected key', 403, 'Permission denied', 'not_configured'],
  ['the free tier limit', 429, 'Resource has been exhausted', 'busy'],
  ['a bad request', 400, 'Invalid JSON schema', 'failed'],
  ['a server error', 503, 'The model is overloaded', 'failed'],
])('reports %s', async (_, status, message, error) => {
  reply(status, { error: { message } });
  await expect(suggestWithGemini(request, 'key')).resolves.toEqual({
    ok: false,
    error,
    detail: `Gemini ${status}: ${message}`,
  });
});

test('gives up after 45 seconds instead of hanging', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation(
    (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
  );
  const result = suggestWithGemini(request, 'key');
  await jest.advanceTimersByTimeAsync(45_000);
  await expect(result).resolves.toEqual({
    ok: false,
    error: 'busy',
    detail: 'Gemini didn’t answer within 45 seconds.',
  });
  jest.useRealTimers();
});

test('describes a network failure, without the key', async () => {
  mockFetch.mockRejectedValue(new TypeError('connection to key-123 failed'));
  await expect(suggestWithGemini(request, 'key-123')).resolves.toEqual({
    ok: false,
    error: 'failed',
    detail: 'Gemini: TypeError: connection to [key] failed',
  });
});

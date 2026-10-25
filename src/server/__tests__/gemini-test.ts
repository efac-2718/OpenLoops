import type { SortRequest } from '@/domain/ai-sort';

import { GEMINI_MODELS, suggestWithGemini } from '../gemini';
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
    ...fields,
  };
}

const OVERLOADED = { error: { message: 'This model is currently experiencing high demand.' } };

const mockFetch = jest.fn();
const respond = (status: number, body: unknown) => ({ status, json: async () => body });
const modelsAsked = () =>
  mockFetch.mock.calls.map(([url]: [string]) => /models\/(.+):generateContent/.exec(url)?.[1]);

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

test('asks the first model for JSON matching the suggestions schema, and reads its answer', async () => {
  mockFetch.mockResolvedValue(respond(200, answer()));

  await expect(suggestWithGemini(request, 'key')).resolves.toEqual({ ok: true, value: { suggestions } });
  expect(modelsAsked()).toEqual([GEMINI_MODELS[0]]);
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS[0]}:generateContent`);
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-goog-api-key': 'key' });
  expect(JSON.parse(init.body)).toEqual({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(request) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: SUGGESTIONS_SCHEMA,
      maxOutputTokens: 8192,
    },
  });
});

test('needs an API key', async () => {
  await expect(suggestWithGemini(request, undefined)).resolves.toEqual({ ok: false, error: 'not_configured' });
  expect(mockFetch).not.toHaveBeenCalled();
});

test.each([
  ['overloaded', respond(503, OVERLOADED)],
  ['out of its free quota', respond(429, { error: { message: 'Quota exceeded' } })],
  ['not offered', respond(404, { error: { message: 'Model not found' } })],
  ['cut short', respond(200, answer({ candidates: [{ finishReason: 'MAX_TOKENS' }] }))],
  ['unreadable', respond(200, answer({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{' }] } }] }))],
])('asks the next model when one is %s', async (_, firstReply) => {
  mockFetch.mockResolvedValueOnce(firstReply).mockResolvedValueOnce(respond(200, answer()));

  await expect(suggestWithGemini(request, 'key')).resolves.toEqual({ ok: true, value: { suggestions } });
  expect(modelsAsked()).toEqual(GEMINI_MODELS.slice(0, 2));
});

test('asks the next model when one doesn’t answer in 25 seconds', async () => {
  jest.useFakeTimers();
  mockFetch
    .mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    )
    .mockResolvedValueOnce(respond(200, answer()));

  const result = suggestWithGemini(request, 'key');
  await jest.advanceTimersByTimeAsync(25_000);
  await expect(result).resolves.toEqual({ ok: true, value: { suggestions } });
  jest.useRealTimers();
});

test('says it is busy when every model is unavailable, and which', async () => {
  mockFetch.mockResolvedValue(respond(503, OVERLOADED));

  const result = await suggestWithGemini(request, 'key');
  expect(modelsAsked()).toEqual(GEMINI_MODELS);
  expect(result).toMatchObject({ ok: false, error: 'busy' });
  expect(!result.ok && result.detail).toContain(`${GEMINI_MODELS[0]} 503: This model is currently experiencing high demand.`);
});

test.each([
  ['a wrong key', respond(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }), 'not_configured'],
  ['a rejected key', respond(403, { error: { message: 'Permission denied' } }), 'not_configured'],
  ['a bad request', respond(400, { error: { message: 'Invalid JSON schema' } }), 'failed'],
  ['a safety stop', respond(200, answer({ candidates: [{ finishReason: 'SAFETY' }] })), 'refused'],
  ['a blocked prompt', respond(200, answer({ candidates: [], promptFeedback: { blockReason: 'OTHER' } })), 'refused'],
])('stops at %s, since another model wouldn’t help', async (_, reply, error) => {
  mockFetch.mockResolvedValue(reply);

  await expect(suggestWithGemini(request, 'key')).resolves.toMatchObject({ ok: false, error });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('describes a network failure, without the key', async () => {
  mockFetch.mockRejectedValue(new TypeError('connection to key-123 failed'));
  await expect(suggestWithGemini(request, 'key-123')).resolves.toEqual({
    ok: false,
    error: 'failed',
    detail: 'Gemini: TypeError: connection to [key] failed',
  });
});

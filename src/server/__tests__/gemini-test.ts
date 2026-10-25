import type { SortRequest } from '@/domain/ai-sort';

import { suggestWithGemini } from '../gemini';
import { SUGGESTIONS_SCHEMA, SYSTEM_PROMPT } from '../sort-prompt';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai/web', () => {
  class ApiError extends Error {
    status: number;
    constructor({ message, status }: { message: string; status: number }) {
      super(message);
      this.status = status;
    }
  }
  class GoogleGenAI {
    models = { generateContent: mockGenerateContent };
  }
  const FinishReason = {
    STOP: 'STOP',
    MAX_TOKENS: 'MAX_TOKENS',
    SAFETY: 'SAFETY',
    PROHIBITED_CONTENT: 'PROHIBITED_CONTENT',
    BLOCKLIST: 'BLOCKLIST',
    SPII: 'SPII',
  };
  return { ApiError, FinishReason, GoogleGenAI };
});

const { ApiError } = jest.requireMock('@google/genai/web');

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

function reply(fields: Record<string, unknown> = {}) {
  return {
    text: JSON.stringify({ suggestions }),
    candidates: [{ finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 200 },
    modelVersion: 'gemini-flash',
    ...fields,
  };
}

beforeEach(() => {
  mockGenerateContent.mockReset();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

test('asks Gemini Flash for JSON matching the suggestions schema', async () => {
  mockGenerateContent.mockResolvedValue(reply());

  await expect(suggestWithGemini(request, 'key')).resolves.toEqual({ ok: true, value: { suggestions } });
  expect(mockGenerateContent).toHaveBeenCalledWith({
    model: 'gemini-flash-latest',
    contents: JSON.stringify(request),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseJsonSchema: SUGGESTIONS_SCHEMA,
    },
  });
});

test('needs an API key', async () => {
  await expect(suggestWithGemini(request, undefined)).resolves.toEqual({ ok: false, error: 'not_configured' });
  expect(mockGenerateContent).not.toHaveBeenCalled();
});

test.each([
  ['a safety stop', { candidates: [{ finishReason: 'SAFETY' }] }, 'refused'],
  ['a blocked prompt', { candidates: [], promptFeedback: { blockReason: 'OTHER' } }, 'refused'],
  ['running out of tokens', { candidates: [{ finishReason: 'MAX_TOKENS' }] }, 'failed'],
  ['text that is not JSON', { text: 'Sure!' }, 'failed'],
])('reports %s', async (_, fields, error) => {
  mockGenerateContent.mockResolvedValue(reply(fields));
  await expect(suggestWithGemini(request, 'key')).resolves.toEqual({ ok: false, error });
});

test.each([
  ['a wrong key', 400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}', 'not_configured'],
  ['a rejected key', 403, 'Forbidden', 'not_configured'],
  ['the free tier limit', 429, 'Too many requests', 'busy'],
  ['a bad request', 400, 'Invalid schema', 'failed'],
  ['any other failure', 500, 'Internal', 'failed'],
])('reports %s', async (_, status, message, error) => {
  mockGenerateContent.mockRejectedValue(new ApiError({ message, status }));
  await expect(suggestWithGemini(request, 'key')).resolves.toEqual({ ok: false, error });
});

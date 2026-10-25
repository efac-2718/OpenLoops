import type { SortRequest } from '@/domain/ai-sort';

import { suggestWithClaude } from '../claude';
import { SUGGESTIONS_SCHEMA } from '../sort-prompt';

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static RateLimitError = RateLimitError;
    beta = { messages: { create: mockCreate } };
  }
  return { __esModule: true, default: Anthropic };
});

const Anthropic = jest.requireMock('@anthropic-ai/sdk').default;

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
    model: 'claude-opus-5-5',
    stop_reason: 'end_turn',
    usage: { input_tokens: 900, output_tokens: 200 },
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: JSON.stringify({ suggestions }) },
    ],
    ...fields,
  };
}

beforeEach(() => {
  mockCreate.mockReset();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('suggestWithClaude', () => {
  test('asks Claude Opus 5.5 for schema-shaped suggestions, with refusal fallback', async () => {
    mockCreate.mockResolvedValue(reply());

    await expect(suggestWithClaude(request, 'key')).resolves.toEqual({ ok: true, value: { suggestions } });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-5-5',
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SUGGESTIONS_SCHEMA } },
        messages: [{ role: 'user', content: JSON.stringify(request) }],
      }),
    );
  });

  test('needs an API key', async () => {
    await expect(suggestWithClaude(request, undefined)).resolves.toEqual({ ok: false, error: 'not_configured' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test.each([
    ['a refusal', { stop_reason: 'refusal', content: [] }, 'refused'],
    ['running out of tokens', { stop_reason: 'max_tokens' }, 'failed'],
    ['text that is not JSON', { content: [{ type: 'text', text: 'Sure!' }] }, 'failed'],
    ['JSON without suggestions', { content: [{ type: 'text', text: '{}' }] }, 'failed'],
  ])('reports %s', async (_, fields, error) => {
    mockCreate.mockResolvedValue(reply(fields));
    await expect(suggestWithClaude(request, 'key')).resolves.toEqual({ ok: false, error });
  });

  test.each([
    ['a rejected key', () => new Anthropic.AuthenticationError('401'), 'not_configured'],
    ['a rate limit', () => new Anthropic.RateLimitError('429'), 'busy'],
    ['any other failure', () => new Anthropic.APIError('500'), 'failed'],
  ])('reports %s', async (_, makeError, error) => {
    mockCreate.mockRejectedValue(makeError());
    await expect(suggestWithClaude(request, 'key')).resolves.toEqual({ ok: false, error });
  });
});

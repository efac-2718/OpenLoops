import type { AiTask } from '../ai-task';
import { askClaude } from '../claude';

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

const suggestions = [{ id: 'a', reason: 'Quick call.' }];
const SCHEMA = { type: 'object' };

// Any AI task: the answer is usable when it has a list of suggestions.
const task: AiTask<{ suggestions: unknown[] }> = {
  name: 'test',
  size: 1,
  system: 'You sort loops.',
  input: 'Call the bank',
  schema: SCHEMA,
  read: (answer) => {
    const list = (answer as { suggestions?: unknown } | null)?.suggestions;
    return Array.isArray(list) ? { suggestions: list } : null;
  },
};

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

describe('askClaude', () => {
  test('asks Claude Opus 5.5 for JSON matching the task’s schema, with refusal fallback', async () => {
    mockCreate.mockResolvedValue(reply());

    await expect(askClaude(task, 'key')).resolves.toEqual({ ok: true, value: { suggestions } });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-5-5',
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        system: 'You sort loops.',
        messages: [{ role: 'user', content: 'Call the bank' }],
      }),
    );
  });

  test('needs an API key', async () => {
    await expect(askClaude(task, undefined)).resolves.toEqual({ ok: false, error: 'not_configured' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test.each([
    ['a refusal', { stop_reason: 'refusal', content: [] }, 'refused'],
    ['running out of tokens', { stop_reason: 'max_tokens' }, 'failed'],
    ['text that is not JSON', { content: [{ type: 'text', text: 'Sure!' }] }, 'failed'],
    ['an answer the task can’t use', { content: [{ type: 'text', text: '{}' }] }, 'failed'],
  ])('reports %s', async (_, fields, error) => {
    mockCreate.mockResolvedValue(reply(fields));
    await expect(askClaude(task, 'key')).resolves.toMatchObject({ ok: false, error });
  });

  test.each([
    ['a rejected key', () => new Anthropic.AuthenticationError('401'), 'not_configured'],
    ['a rate limit', () => new Anthropic.RateLimitError('429'), 'busy'],
    ['any other failure', () => new Anthropic.APIError('500'), 'failed'],
  ])('reports %s', async (_, makeError, error) => {
    mockCreate.mockRejectedValue(makeError());
    await expect(askClaude(task, 'key')).resolves.toMatchObject({ ok: false, error });
  });
});

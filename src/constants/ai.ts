/**
 * Where the AI server (src/app/api, deployed to EAS Hosting) lives. Null until
 * it's deployed; AI suggestions stay hidden until then. Set
 * EXPO_PUBLIC_AI_SERVER_ORIGIN to point a local build somewhere else.
 */
export const AI_SERVER_ORIGIN: string | null = process.env.EXPO_PUBLIC_AI_SERVER_ORIGIN || null;

export type AiProvider = 'gemini' | 'claude';

/**
 * Which AI service suggests decisions: Google's Gemini on its free tier for
 * now, Anthropic's Claude once its API key is set up. To switch, add that
 * service's key to the server (see README, AI suggestions) and change this;
 * both the app and the server read it.
 */
export const AI_PROVIDER: AiProvider = 'gemini';

const SERVICES: Record<AiProvider, { name: string; company: string; dataUse: string | null }> = {
  gemini: {
    name: 'Gemini',
    company: 'Google',
    dataUse:
      'This uses Google’s free tier, so Google may use what’s sent to improve its products, and people at Google may read it.',
  },
  claude: { name: 'Claude', company: 'Anthropic', dataUse: null },
};

export const AI_SERVICE = SERVICES[AI_PROVIDER];

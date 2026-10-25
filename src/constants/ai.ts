/**
 * Where the AI server (src/app/api, deployed to EAS Hosting) lives. Null until
 * it's deployed; AI suggestions stay hidden until then. Set
 * EXPO_PUBLIC_AI_SERVER_ORIGIN to point a local build somewhere else.
 */
export const AI_SERVER_ORIGIN: string | null = process.env.EXPO_PUBLIC_AI_SERVER_ORIGIN || null;

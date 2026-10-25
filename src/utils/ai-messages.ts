import { AI_SERVICE } from '@/constants/ai';
import type { AiCallError } from '@/services/ai';

const MESSAGES: Record<AiCallError, string> = {
  unavailable: 'AI help isn’t available in this version of the app.',
  offline: 'Couldn’t reach the AI server. Check your connection and try again.',
  not_configured: 'The AI server isn’t set up yet: its API key is missing or not working.',
  busy: 'The AI service is busy or has reached its daily limit. Try again later.',
  refused: `${AI_SERVICE.name} declined this one.`,
  failed: 'Something went wrong. Try again.',
};

/** What to tell the person when an AI request fails. */
export function aiErrorMessage(error: AiCallError): string {
  return MESSAGES[error];
}

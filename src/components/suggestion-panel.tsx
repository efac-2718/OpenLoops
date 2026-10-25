import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { decideLoop } from '@/db/loops';
import type { Suggestion } from '@/domain/ai-sort';
import type { DecisionError } from '@/domain/loop';
import { useTheme } from '@/hooks/use-theme';
import { describeSuggestion } from '@/utils/describe-loop';

import { CardAction } from './loop-card';
import { ThemedText } from './themed-text';

const ACCEPT_LABELS: Partial<Record<Suggestion['decision']['kind'], string>> = {
  done: 'Mark done',
  dropped: 'Drop it',
};

const ACCEPT_ERRORS: Partial<Record<DecisionError | 'not_found', string>> = {
  active_cap_reached: 'You’re at your active-loop limit. Tap the loop to choose something else.',
  date_in_past: 'That day has passed. Tap the loop to pick another.',
};

/** A suggested decision on an inbox card: what it would do, why, and Accept. */
export function SuggestionPanel({ suggestion, testID }: { suggestion: Suggestion; testID?: string }) {
  const theme = useTheme();
  const [now] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  function accept() {
    const result = decideLoop(suggestion.loopId, suggestion.decision);
    if (!result.ok) {
      setError(ACCEPT_ERRORS[result.error] ?? 'This suggestion no longer fits. Tap the loop to decide.');
    }
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.background }]} testID={testID}>
      <View style={styles.text}>
        <ThemedText type="small" themeColor="textSecondary">
          Suggested
        </ThemedText>
        <ThemedText type="smallBold">{describeSuggestion(suggestion.decision, now)}</ThemedText>
        {suggestion.reason ? (
          <ThemedText type="small" themeColor="textSecondary">
            {suggestion.reason}
          </ThemedText>
        ) : null}
        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}
      </View>
      <CardAction
        testID={testID && `${testID}-accept`}
        label={ACCEPT_LABELS[suggestion.decision.kind] ?? 'Accept'}
        onPress={accept}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});

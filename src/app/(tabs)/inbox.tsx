import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { CardAction, LoopCard } from '@/components/loop-card';
import { ScreenHeader } from '@/components/screen-header';
import { SuggestionPanel } from '@/components/suggestion-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AI_SERVICE } from '@/constants/ai';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { activeQuery, inboxQuery, type LoopRow } from '@/db/loops';
import { MAX_LOOPS_PER_SORT } from '@/domain/ai-sort';
import {
  requestSuggestions,
  suggestionFor,
  useAiSuggestions,
  type AiSuggestions,
} from '@/hooks/use-ai-suggestions';
import { useActiveCap, useAiSuggestionsEnabled } from '@/hooks/use-settings';
import type { AiSortError } from '@/services/ai-sort';
import { loopCount, loopsNeed } from '@/utils/plural';
import { timeAgo } from '@/utils/time-ago';

export default function InboxScreen() {
  const { data: inbox } = useLiveQuery(inboxQuery());
  const aiEnabled = useAiSuggestionsEnabled();
  const suggestions = useAiSuggestions();
  const now = new Date();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={inbox}
          keyExtractor={(loop) => loop.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <ScreenHeader title="Inbox">
                {inbox.length > 0
                  ? `${loopsNeed(inbox.length)} a decision. Each one leaves with a next step, a day, a person, or a conscious no.`
                  : null}
              </ScreenHeader>
              {aiEnabled && inbox.length > 0 ? (
                <SuggestDecisions inbox={inbox} suggestions={suggestions} />
              ) : null}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title="Inbox zero"
              action={
                <Button
                  label="Capture something"
                  variant="secondary"
                  onPress={() => router.navigate('/')}
                />
              }>
              Nothing is waiting for a decision. When something new is on your mind, put it on the
              Capture tab.
            </EmptyState>
          }
          ItemSeparatorComponent={Separator}
          renderItem={({ item, index }) => {
            const suggestion = aiEnabled ? suggestionFor(suggestions, item) : null;
            return (
              <LoopCard
                testID={`inbox-row-${index}`}
                title={item.title}
                detail={`Captured ${timeAgo(item.createdAt, now)}`}
                onPress={() => router.push({ pathname: '/decide/[id]', params: { id: item.id } })}
                action={<CardAction label="Decide" />}
                footer={
                  suggestion ? (
                    <SuggestionPanel suggestion={suggestion} testID={`inbox-suggestion-${index}`} />
                  ) : undefined
                }
              />
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const SORT_ERRORS: Record<AiSortError, string> = {
  unavailable: 'AI suggestions aren’t available in this version of the app.',
  offline: 'Couldn’t reach the AI server. Check your connection and try again.',
  not_configured: 'The AI server isn’t set up yet: its API key is missing or not working.',
  busy: 'The AI service is busy or has reached its daily limit. Try again later.',
  refused: `${AI_SERVICE.name} declined to suggest decisions for these loops.`,
  failed: 'Something went wrong getting suggestions. Try again.',
};

function SuggestDecisions({ inbox, suggestions }: { inbox: LoopRow[]; suggestions: AiSuggestions }) {
  const { data: active } = useLiveQuery(activeQuery());
  const activeCap = useActiveCap();
  const pending = inbox.filter((loop) => !suggestionFor(suggestions, loop));
  const loading = suggestions.status === 'loading';

  let status: string | null = null;
  if (loading) {
    status = `${AI_SERVICE.name} is looking at ${loopCount(Math.min(pending.length, MAX_LOOPS_PER_SORT))}…`;
  } else if (suggestions.status === 'error' && suggestions.error) {
    status = SORT_ERRORS[suggestions.error];
  } else if (suggestions.status === 'done') {
    status =
      suggestions.received > 0
        ? 'Accept a suggestion, or tap the loop to change it. You decide each one.'
        : 'No suggestions came back this time. Try again, or decide these yourself.';
  }

  return (
    <View style={styles.suggest}>
      {pending.length > 0 ? (
        <Button
          testID="suggest-decisions"
          label={
            loading
              ? 'Getting suggestions…'
              : pending.length < inbox.length
                ? `Suggest decisions for ${loopCount(pending.length)}`
                : 'Suggest decisions'
          }
          variant="secondary"
          disabled={loading}
          onPress={() => requestSuggestions(pending, { activeCount: active.length, activeCap })}
        />
      ) : null}
      {status ? (
        <ThemedText
          type="small"
          themeColor={suggestions.status === 'error' ? 'danger' : 'textSecondary'}
          testID="suggest-status">
          {status}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  suggest: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  separator: {
    height: Spacing.two,
  },
});

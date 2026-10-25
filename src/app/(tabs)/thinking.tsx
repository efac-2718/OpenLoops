import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { CardAction, LoopCard } from '@/components/loop-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { thinkingQuery } from '@/db/loops';
import { attentionReason } from '@/domain/loop';
import { formatDayInline } from '@/utils/describe-loop';

export default function ThinkingScreen() {
  const { data: thinking } = useLiveQuery(thinkingQuery());
  const now = new Date();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={thinking}
          keyExtractor={(loop) => loop.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <ScreenHeader title="Thinking on this">
              Open on purpose. These aren&apos;t tasks, so there&apos;s nothing here to fall behind
              on.
            </ScreenHeader>
          }
          ListEmptyComponent={
            <EmptyState title="Nothing parked">
              When something needs time to think, choose “Thinking on this” when you decide it.
              It comes back here on the day you pick.
            </EmptyState>
          }
          ItemSeparatorComponent={Separator}
          renderItem={({ item, index }) => {
            const ready = attentionReason(item, now) === 'revisit';
            return (
              <LoopCard
                testID={`thinking-row-${index}`}
                title={item.title}
                detail={
                  ready ? 'Ready to revisit' : `Revisit ${item.revisitAt ? formatDayInline(item.revisitAt, now) : 'later'}`
                }
                detailColor={ready ? 'accent' : undefined}
                onPress={() => router.push({ pathname: '/decide/[id]', params: { id: item.id } })}
                action={ready ? <CardAction label="Decide" /> : null}
              />
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
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
  separator: {
    height: Spacing.two,
  },
});

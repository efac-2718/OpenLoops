import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { CardAction, LoopCard } from '@/components/loop-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { inboxQuery } from '@/db/loops';
import { loopsNeed } from '@/utils/plural';
import { timeAgo } from '@/utils/time-ago';

export default function InboxScreen() {
  const { data: inbox } = useLiveQuery(inboxQuery());
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
            <ScreenHeader title="Inbox">
              {inbox.length > 0
                ? `${loopsNeed(inbox.length)} a decision. Each one leaves with a next step, a day, a person, or a conscious no.`
                : null}
            </ScreenHeader>
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
          renderItem={({ item, index }) => (
            <LoopCard
              testID={`inbox-row-${index}`}
              title={item.title}
              detail={`Captured ${timeAgo(item.createdAt, now)}`}
              onPress={() => router.push({ pathname: '/decide/[id]', params: { id: item.id } })}
              action={<CardAction label="Decide" />}
            />
          )}
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

import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { inboxQuery, type LoopRow } from '@/db/loops';
import { useTheme } from '@/hooks/use-theme';
import { loopCount } from '@/utils/plural';
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
          ListHeaderComponent={<InboxHeader count={inbox.length} />}
          ListEmptyComponent={<EmptyInbox />}
          ItemSeparatorComponent={Separator}
          renderItem={({ item, index }) => <InboxRow loop={item} index={index} now={now} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function InboxHeader({ count }: { count: number }) {
  return (
    <View style={styles.header}>
      <ThemedText type="subtitle">Inbox</ThemedText>
      {count > 0 ? (
        <ThemedText themeColor="textSecondary">
          {loopCount(count)} need a decision. Each one leaves with a next step, a day, a person, or
          a conscious no.
        </ThemedText>
      ) : null}
    </View>
  );
}

function InboxRow({ loop, index, now }: { loop: LoopRow; index: number; now: Date }) {
  const theme = useTheme();

  return (
    // router.push rather than <Link asChild>: on web, Link drops Pressable's style function.
    <Pressable
      testID={`inbox-row-${index}`}
      accessibilityRole="button"
      accessibilityHint="Decide what to do with this loop"
      onPress={() => router.push({ pathname: '/decide/[id]', params: { id: loop.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <View style={styles.rowText}>
        <ThemedText>{loop.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Captured {timeAgo(loop.createdAt, now)}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" themeColor="accent">
        Decide
      </ThemedText>
    </Pressable>
  );
}

function EmptyInbox() {
  return (
    <ThemedView type="backgroundElement" style={styles.empty}>
      <ThemedText type="smallBold">Inbox zero</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Nothing is waiting for a decision. When something new is on your mind, put it on the
        Capture tab.
      </ThemedText>
      <Button label="Capture something" variant="secondary" onPress={() => router.navigate('/')} />
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
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
  separator: {
    height: Spacing.two,
  },
  empty: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
});

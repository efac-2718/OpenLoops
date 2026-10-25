import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { CardAction, LoopCard } from '@/components/loop-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { activeQuery, decideLoop, type LoopRow } from '@/db/loops';
import { useActiveCap } from '@/hooks/use-settings';
import { loopCardText } from '@/utils/describe-loop';

type Section = { title: string; data: LoopRow[] };

export default function ActiveScreen() {
  const { data: active } = useLiveQuery(activeQuery());
  const cap = useActiveCap();
  const now = new Date();

  const sections: Section[] = [
    { title: 'Scheduled', data: active.filter((loop) => loop.state === 'scheduled') },
    { title: 'Next actions', data: active.filter((loop) => loop.state === 'next') },
    { title: 'Waiting on someone', data: active.filter((loop) => loop.state === 'waiting') },
  ].filter((section) => section.data.length > 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <SectionList
          sections={sections}
          keyExtractor={(loop) => loop.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <ScreenHeader title="Active">
              {active.length >= cap
                ? `${active.length} of ${cap}: you're at your limit. Finish, delegate, or park something before taking on more.`
                : `${active.length} of ${cap} active loops.`}
            </ScreenHeader>
          }
          ListEmptyComponent={
            <EmptyState title="Nothing active">
              Loops you give a next action, a day, or a person show up here.
            </EmptyState>
          }
          renderSectionHeader={({ section }) => (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              {section.title}
            </ThemedText>
          )}
          ItemSeparatorComponent={Separator}
          renderItem={({ item, index, section }) => (
            <ActiveCard loop={item} now={now} testID={`active-${section.title}-${index}`} />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function ActiveCard({ loop, now, testID }: { loop: LoopRow; now: Date; testID: string }) {
  const { title, detail, overdue } = loopCardText(loop, now);
  return (
    <LoopCard
      testID={testID}
      title={title}
      detail={detail}
      detailColor={overdue ? 'danger' : undefined}
      onPress={() => router.push({ pathname: '/decide/[id]', params: { id: loop.id } })}
      action={
        <CardAction
          label="Done"
          testID={`${testID}-done`}
          onPress={() => decideLoop(loop.id, { kind: 'done' })}
        />
      }
    />
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
  sectionHeader: {
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  separator: {
    height: Spacing.two,
  },
});

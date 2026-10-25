import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { CardAction, LoopCard } from '@/components/loop-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { closeDay, todayCloseQuery } from '@/db/closes';
import { closeCandidatesQuery, type LoopRow } from '@/db/loops';
import { lastFinishedReviewQuery, openReviewQuery, startReview } from '@/db/reviews';
import { setSetting } from '@/db/settings';
import { dayKey } from '@/domain/dates';
import { attentionReason, type AttentionReason } from '@/domain/loop';
import {
  CLOSE_TIME_OPTIONS,
  formatCloseTime,
  sameCloseTime,
  type CloseTime,
} from '@/domain/reminder';
import { isReviewDue, nextReviewDay } from '@/domain/review';
import { useCloseTime } from '@/hooks/use-settings';
import {
  sendTestReminder,
  setCloseReminder,
  type ReminderResult,
} from '@/services/close-reminder';
import { formatDayInline } from '@/utils/describe-loop';
import { timeAgo } from '@/utils/time-ago';
import { loopCount, loopsNeed } from '@/utils/plural';

// Most pressing first: things already late, then today's, then undecided, then rethinks.
const REASON_ORDER: AttentionReason[] = ['overdue', 'due_today', 'undecided', 'revisit'];

export default function CloseScreen() {
  const now = new Date();
  const { data: candidates } = useLiveQuery(closeCandidatesQuery());
  const { data: closes } = useLiveQuery(todayCloseQuery(now), [dayKey(now)]);
  const closedToday = closes[0];

  const attention = candidates
    .map((loop) => ({ loop, reason: attentionReason(loop, now) }))
    .filter((item): item is { loop: LoopRow; reason: AttentionReason } => item.reason !== null)
    .sort((a, b) => REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <ScreenHeader title="Close the day" style={styles.header}>
            {attention.length > 0
              ? `${loopsNeed(attention.length)} a decision before bed. Give each one a home, then close the day.`
              : 'Before bed, make sure everything on your mind has a home.'}
          </ScreenHeader>

          {attention.length > 0 ? (
            <View style={styles.list}>
              {closedToday ? (
                <ThemedText type="small" themeColor="textSecondary">
                  You closed the day earlier, and new loops have come in since.
                </ThemedText>
              ) : null}
              {attention.map(({ loop, reason }, index) => (
                <LoopCard
                  key={loop.id}
                  testID={`close-row-${index}`}
                  title={loop.state === 'scheduled' ? (loop.nextAction ?? loop.title) : loop.title}
                  detail={describeReason(loop, reason, now)}
                  detailColor={reason === 'overdue' ? 'danger' : undefined}
                  onPress={() => router.push({ pathname: '/decide/[id]', params: { id: loop.id } })}
                  action={<CardAction label="Decide" />}
                />
              ))}
            </View>
          ) : closedToday ? (
            <ThemedView type="backgroundElement" style={styles.card} testID="close-done">
              <ThemedText type="smallBold">Day closed</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Everything has a home.{' '}
                {closedToday.resolvedCount > 0
                  ? `You gave ${loopCount(closedToday.resolvedCount)} a decision today. `
                  : ''}
                Sleep well.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Everything has a home</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Every open loop has a next step, a day, a person, or a conscious no. Nothing needs
                holding in your head tonight.
              </ThemedText>
              <Button testID="close-day" label="Close the day" onPress={() => closeDay(new Date())} />
            </ThemedView>
          )}

          <WeeklyReviewCard />
          <ReminderSettings />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function WeeklyReviewCard() {
  const { data: open } = useLiveQuery(openReviewQuery());
  const { data: finished } = useLiveQuery(lastFinishedReviewQuery());
  const now = new Date();
  const inProgress = open.length > 0;
  const lastFinishedAt = finished[0]?.completedAt ?? null;
  const due = isReviewDue(lastFinishedAt, now);

  let text: string;
  if (inProgress) {
    text = 'You’re partway through a review. Pick up where you left off.';
  } else if (!lastFinishedAt) {
    text = 'Once a week, look through every open loop so the system stays trustworthy. About five minutes.';
  } else if (due) {
    text = `Your last review was ${timeAgo(lastFinishedAt, now)}. About five minutes.`;
  } else {
    text = `Last done ${timeAgo(lastFinishedAt, now)}. Next one ${formatDayInline(nextReviewDay(lastFinishedAt), now)}.`;
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card} testID="weekly-review-card">
      <ThemedText type="smallBold">Weekly review</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
      <Button
        testID="start-review"
        label={inProgress ? 'Continue weekly review' : due ? 'Start weekly review' : 'Review now'}
        variant={inProgress || due ? 'primary' : 'secondary'}
        onPress={() => {
          startReview(new Date());
          router.push('/review');
        }}
      />
    </ThemedView>
  );
}

function describeReason(loop: LoopRow, reason: AttentionReason, now: Date): string {
  switch (reason) {
    case 'undecided':
      return 'In your inbox';
    case 'due_today':
      return `Planned for today · ${loop.title}`;
    case 'overdue':
      return `Overdue since ${loop.dueAt ? formatDayInline(loop.dueAt, now) : 'earlier'} · ${loop.title}`;
    case 'revisit':
      return 'Time to revisit';
  }
}

const formatTime = ({ hour, minute }: CloseTime) =>
  new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

function ReminderSettings() {
  const closeTime = useCloseTime();
  const [result, setResult] = useState<{ outcome: ReminderResult; test: boolean } | null>(null);

  async function choose(time: CloseTime | null) {
    const outcome = await setCloseReminder(time);
    // Without permission, or without notifications at all, there is no reminder: keep the old setting.
    if (outcome !== 'denied' && outcome !== 'unavailable') {
      setSetting('close_time', time ? formatCloseTime(time) : 'off');
    }
    setResult({ outcome, test: false });
  }

  async function test() {
    setResult({ outcome: await sendTestReminder(), test: true });
  }

  let status: string;
  if (result?.outcome === 'denied') {
    status =
      'Notifications are turned off for Open Loops. Turn them on in your phone’s Settings, then try again.';
  } else if (result?.outcome === 'unavailable') {
    status =
      'This copy of the app can’t schedule reminders. Expo Go on Android may not support them; an installed build of the app will.';
  } else if (result?.outcome === 'unsupported') {
    status = 'Reminders work in the phone app.';
  } else if (result?.test) {
    status = 'A test reminder is on its way. It should arrive in about 5 seconds.';
  } else if (closeTime) {
    status = `Every night at ${formatTime(closeTime)}.`;
  } else {
    status = 'Pick a time and Open Loops will remind you to close the day.';
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Nightly reminder</ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {CLOSE_TIME_OPTIONS.map((time, index) => (
          <Chip
            key={formatCloseTime(time)}
            testID={`reminder-${index}`}
            label={formatTime(time)}
            selected={sameCloseTime(time, closeTime)}
            onPress={() => choose(time)}
          />
        ))}
        <Chip
          testID="reminder-off"
          label="Off"
          selected={closeTime === null}
          onPress={() => choose(null)}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" testID="reminder-status">
        {status}
      </ThemedText>
      <Pressable
        testID="reminder-test"
        accessibilityRole="button"
        hitSlop={Spacing.two}
        onPress={test}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="smallBold" themeColor="accent">
          Send a test reminder
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  scroll: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: {
    // The scroll content's gap already spaces the header from what follows.
    marginBottom: 0,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});

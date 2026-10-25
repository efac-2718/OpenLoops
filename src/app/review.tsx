import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { CaptureForm } from '@/components/capture-form';
import { EmptyState } from '@/components/empty-state';
import { CardAction, LoopCard } from '@/components/loop-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { decideLoop, keepLoop, type LoopRow } from '@/db/loops';
import {
  finishReview,
  openReviewQuery,
  reviewableLoopsQuery,
  startReview,
  type ReviewRow,
} from '@/db/reviews';
import {
  REVIEW_STEPS,
  canKeep,
  nextReviewDay,
  pendingForStep,
  resumeStep,
  type ReviewStep,
} from '@/domain/review';
import { formatDayInline, loopCardText } from '@/utils/describe-loop';
import { loopCount } from '@/utils/plural';

const STEPS: Record<ReviewStep, { title: string; prompt: string; clear: string }> = {
  mind_sweep: {
    title: 'Empty your head',
    prompt:
      'Anything on your mind that isn’t in the app yet? Promises, worries, ideas, things you’re waiting on.',
    clear: '',
  },
  inbox: {
    title: 'Inbox',
    prompt: 'Give everything in your inbox a decision.',
    clear: 'Your inbox is empty.',
  },
  scheduled: {
    title: 'Scheduled',
    prompt: 'Still the right day? Keep it, finish it, drop it, or tap it to change it.',
    clear: 'Nothing scheduled left to look at.',
  },
  next: {
    title: 'Next actions',
    prompt: 'Is each one still the very next step?',
    clear: 'No next actions left to look at.',
  },
  waiting: {
    title: 'Waiting on someone',
    prompt: 'Got what you needed, or is it time to follow up?',
    clear: 'Nothing waiting left to look at.',
  },
  thinking: {
    title: 'Thinking on this',
    prompt: 'Ready to decide, still mulling it over, or time to let it go?',
    clear: 'Nothing parked left to look at.',
  },
};

const time = (date: Date | null) => date?.getTime() ?? 0;

/** The order each step lists its loops in: soonest or longest-waiting first. */
function sortForStep(step: ReviewStep, loops: LoopRow[]): LoopRow[] {
  const by = (key: (loop: LoopRow) => Date | null) =>
    [...loops].sort((a, b) => time(key(a)) - time(key(b)));
  switch (step) {
    case 'scheduled':
      return by((loop) => loop.dueAt);
    case 'thinking':
      return by((loop) => loop.revisitAt);
    case 'inbox':
      return by((loop) => loop.createdAt);
    default:
      return by((loop) => loop.decidedAt);
  }
}

export default function ReviewScreen() {
  const { data: open, updatedAt } = useLiveQuery(openReviewQuery());
  const { data: loops, updatedAt: loopsLoaded } = useLiveQuery(reviewableLoopsQuery());
  const [finished, setFinished] = useState<{ reviewedCount: number; at: Date } | null>(null);
  const review = open[0];

  let content;
  if (finished) {
    content = <ReviewDone {...finished} />;
  } else if (review && loopsLoaded) {
    content = (
      <ReviewSteps
        key={review.id}
        review={review}
        loops={loops}
        initialStep={resumeStep(loops, review.startedAt)}
        onFinished={setFinished}
      />
    );
  } else if (updatedAt && !review) {
    content = (
      <EmptyState
        title="No review in progress"
        action={<Button label="Start weekly review" onPress={() => startReview(new Date())} />}>
        A weekly look through everything keeps the system trustworthy. It takes about five
        minutes.
      </EmptyState>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <View style={styles.inner}>{content}</View>
      </ScrollView>
    </ThemedView>
  );
}

function ReviewSteps({
  review,
  loops,
  initialStep,
  onFinished,
}: {
  review: ReviewRow;
  loops: LoopRow[];
  /** Where the review opens; after that the user moves between steps. */
  initialStep: ReviewStep;
  onFinished: (result: { reviewedCount: number; at: Date }) => void;
}) {
  const [stepIndex, setStepIndex] = useState(() => REVIEW_STEPS.indexOf(initialStep));
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  const step = REVIEW_STEPS[stepIndex];
  const copy = STEPS[step];
  const pending = sortForStep(step, pendingForStep(step, loops, review.startedAt));
  const isLast = stepIndex === REVIEW_STEPS.length - 1;

  function go(index: number) {
    setError(null);
    setStepIndex(index);
  }

  function finish() {
    const at = new Date();
    const result = finishReview(review.id, at);
    if (result.ok) {
      onFinished({ reviewedCount: result.value.reviewedCount, at });
      return;
    }
    // New loops can turn up in an earlier step, for example one captured on another tab.
    const unfinished = REVIEW_STEPS.filter(
      (s) => pendingForStep(s, loops, review.startedAt).length > 0,
    ).map((s) => STEPS[s].title);
    setError(`Still to look at: ${unfinished.join(', ')}.`);
  }

  return (
    <>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" testID="review-progress">
          Weekly review · Step {stepIndex + 1} of {REVIEW_STEPS.length}
        </ThemedText>
        <ThemedText type="subtitle">{copy.title}</ThemedText>
        <ThemedText themeColor="textSecondary">{copy.prompt}</ThemedText>
      </View>

      {step === 'mind_sweep' ? (
        <CaptureForm autoFocus={false} inboxLink={false} />
      ) : pending.length === 0 ? (
        <EmptyState title="All clear" testID="review-step-clear">
          {copy.clear}
        </EmptyState>
      ) : (
        <View style={styles.list}>
          {pending.map((loop, index) => (
            <ReviewItem key={loop.id} loop={loop} now={now} testID={`review-item-${index}`} />
          ))}
        </View>
      )}

      {error ? (
        <ThemedText type="small" themeColor="danger" testID="review-error">
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.nav}>
        {stepIndex > 0 ? (
          <View style={styles.navButton}>
            <Button label="Back" variant="secondary" onPress={() => go(stepIndex - 1)} />
          </View>
        ) : null}
        <View style={styles.navButton}>
          <Button
            testID="review-next"
            label={isLast ? 'Finish review' : 'Next'}
            disabled={pending.length > 0}
            onPress={isLast ? finish : () => go(stepIndex + 1)}
          />
        </View>
      </View>
      {pending.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {step === 'inbox'
            ? 'Decide each one to continue.'
            : 'Keep, finish, drop, or change each one to continue.'}
        </ThemedText>
      ) : null}
    </>
  );
}

function ReviewItem({ loop, now, testID }: { loop: LoopRow; now: Date; testID: string }) {
  const { title, detail, overdue } = loopCardText(loop, now);
  const open = () => router.push({ pathname: '/decide/[id]', params: { id: loop.id } });

  if (loop.state === 'inbox') {
    return (
      <LoopCard
        testID={testID}
        title={title}
        detail={detail}
        onPress={open}
        action={<CardAction label="Decide" />}
      />
    );
  }

  return (
    <LoopCard
      testID={testID}
      title={title}
      detail={detail}
      detailColor={overdue ? 'danger' : undefined}
      onPress={open}
      footer={
        <View style={styles.actions}>
          {/* A decision that no longer holds (an overdue day, a revisit day that has come) can't just be kept. */}
          {canKeep(loop, now) ? (
            <CardAction label="Keep" testID={`${testID}-keep`} onPress={() => keepLoop(loop.id)} />
          ) : null}
          <CardAction
            label="Done"
            testID={`${testID}-done`}
            onPress={() => decideLoop(loop.id, { kind: 'done' })}
          />
          <CardAction
            label="Drop"
            testID={`${testID}-drop`}
            onPress={() => decideLoop(loop.id, { kind: 'dropped' })}
          />
        </View>
      }
    />
  );
}

function ReviewDone({ reviewedCount, at }: { reviewedCount: number; at: Date }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card} testID="review-done">
      <ThemedText type="subtitle">Review done</ThemedText>
      <ThemedText themeColor="textSecondary">
        You looked at {loopCount(reviewedCount)}, and everything has a home. Next review{' '}
        {formatDayInline(nextReviewDay(at), at)}.
      </ThemedText>
      <Button
        label="Close"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/close'))}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  nav: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  navButton: {
    flex: 1,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
});

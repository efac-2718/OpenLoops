import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { decideLoop, loopQuery } from '@/db/loops';
import { revisitOptions, scheduleOptions, type QuickDate } from '@/domain/dates';
import type { Decision, DecisionError, DecisionKind } from '@/domain/loop';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/utils/time-ago';

const OPTIONS: { kind: DecisionKind; label: string; hint: string; confirm: string }[] = [
  {
    kind: 'done',
    label: 'Do it now',
    hint: 'It takes about 2 minutes. Do it, then mark it done.',
    confirm: 'Mark done',
  },
  {
    kind: 'next',
    label: 'Next action',
    hint: 'Name the very next physical step.',
    confirm: 'Save next action',
  },
  {
    kind: 'scheduled',
    label: 'Schedule it',
    hint: 'Pick the day you’ll take the next step.',
    confirm: 'Schedule',
  },
  {
    kind: 'waiting',
    label: 'Delegate',
    hint: 'Someone else has it. Note who you’re waiting on.',
    confirm: 'Save as waiting',
  },
  {
    kind: 'thinking',
    label: 'Thinking on this',
    hint: 'Leave it open on purpose and come back to it.',
    confirm: 'Park it',
  },
  {
    kind: 'dropped',
    label: 'Drop it',
    hint: 'Decide consciously not to do this.',
    confirm: 'Drop it',
  },
];

const ERRORS: Record<DecisionError | 'not_found' | 'missing_day', string> = {
  already_closed: 'This loop is already closed.',
  missing_next_action: 'Write the next action: what’s the very next physical step?',
  missing_waiting_on: 'Write who you’re waiting on.',
  missing_day: 'Pick a day.',
  date_in_past: 'Pick today or a later day.',
  active_cap_reached:
    'You’re at your limit of active loops. Finish, park, or drop one first, or choose “Thinking on this” for now.',
  not_found: 'This loop no longer exists.',
};

const formatDay = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export default function DecideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(loopQuery(id), [id]);
  const loop = data[0];

  const [now] = useState(() => new Date());
  const [kind, setKind] = useState<DecisionKind | null>(null);
  const [nextAction, setNextAction] = useState('');
  const [waitingOn, setWaitingOn] = useState('');
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [revisitAt, setRevisitAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loop) return <ThemedView style={styles.container} />;

  const selected = OPTIONS.find((option) => option.kind === kind);

  function choose(next: DecisionKind) {
    setKind(next);
    setError(null);
  }

  /** Wraps a field setter so an error disappears as soon as the user acts on it. */
  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setError(null);
    };
  }

  function buildDecision(): Decision | 'missing_day' | null {
    switch (kind) {
      case null:
        return null;
      case 'done':
      case 'dropped':
        return { kind };
      case 'next':
        return { kind, nextAction };
      case 'scheduled':
        return dueAt ? { kind, nextAction, dueAt } : 'missing_day';
      case 'waiting':
        return { kind, waitingOn };
      case 'thinking':
        return revisitAt ? { kind, revisitAt } : 'missing_day';
    }
  }

  function confirm() {
    const decision = buildDecision();
    if (decision === null) return;
    if (decision === 'missing_day') {
      setError(ERRORS.missing_day);
      return;
    }
    const result = decideLoop(loop.id, decision);
    if (!result.ok) {
      setError(ERRORS[result.error]);
      return;
    }
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <View style={styles.inner}>
          <ThemedView type="backgroundElement" style={styles.loopCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Open loop · captured {timeAgo(loop.createdAt, now)}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.loopTitle} testID="decide-title">
              {loop.title}
            </ThemedText>
          </ThemedView>

          <ThemedText type="smallBold">What&apos;s the decision?</ThemedText>

          <View style={styles.options} accessibilityRole="radiogroup">
            {OPTIONS.map((option) => (
              <OptionCard
                key={option.kind}
                label={option.label}
                hint={option.hint}
                selected={option.kind === kind}
                onPress={() => choose(option.kind)}
                testID={`decide-option-${option.kind}`}>
                {option.kind === 'next' || option.kind === 'scheduled' ? (
                  <TextField
                    testID="decide-next-action"
                    value={nextAction}
                    onChangeText={edit(setNextAction)}
                    placeholder="Email Sam about the leak"
                    multiline
                    submitBehavior="blurAndSubmit"
                    autoFocus
                  />
                ) : null}
                {option.kind === 'scheduled' ? (
                  <DayPicker
                    options={scheduleOptions(now)}
                    value={dueAt}
                    onChange={edit(setDueAt)}
                    testIDPrefix="decide-due"
                  />
                ) : null}
                {option.kind === 'waiting' ? (
                  <TextField
                    testID="decide-waiting-on"
                    value={waitingOn}
                    onChangeText={edit(setWaitingOn)}
                    placeholder="Who? e.g. Priya from accounts"
                    autoFocus
                  />
                ) : null}
                {option.kind === 'thinking' ? (
                  <DayPicker
                    options={revisitOptions(now)}
                    value={revisitAt}
                    onChange={edit(setRevisitAt)}
                    testIDPrefix="decide-revisit"
                  />
                ) : null}
              </OptionCard>
            ))}
          </View>

          {error ? (
            <ThemedText type="small" themeColor="danger" testID="decide-error">
              {error}
            </ThemedText>
          ) : null}

          <Button
            testID="decide-confirm"
            label={selected?.confirm ?? 'Choose a decision'}
            disabled={!selected}
            onPress={confirm}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

type OptionCardProps = {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  children: ReactNode;
};

function OptionCard({ label, hint, selected, onPress, testID, children }: OptionCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.option,
        {
          backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: selected ? theme.accent : 'transparent',
        },
      ]}>
      <Pressable
        testID={testID}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [styles.optionHeader, pressed && styles.pressed]}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </Pressable>
      {/* Only the chosen option shows its fields, so the screen asks one question at a time. */}
      {selected && children ? <View style={styles.optionFields}>{children}</View> : null}
    </View>
  );
}

type DayPickerProps = {
  options: QuickDate[];
  value: Date | null;
  onChange: (date: Date) => void;
  testIDPrefix: string;
};

function DayPicker({ options, value, onChange, testIDPrefix }: DayPickerProps) {
  return (
    <View style={styles.days} accessibilityRole="radiogroup">
      {options.map((option, index) => (
        <Chip
          key={option.label}
          testID={`${testIDPrefix}-${index}`}
          label={option.label}
          detail={formatDay(option.date)}
          selected={value?.getTime() === option.date.getTime()}
          onPress={() => onChange(option.date)}
        />
      ))}
    </View>
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
  loopCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  loopTitle: {
    fontSize: 20,
    lineHeight: 28,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  optionHeader: {
    padding: Spacing.three,
    gap: Spacing.half,
  },
  optionFields: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});

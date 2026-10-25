import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance } from 'react-native';

import { Spacing } from '@/constants/theme';
import { captureLoop, captureLoops } from '@/db/loops';
import { splitBrainDump } from '@/domain/brain-dump';
import { useInboxCount } from '@/hooks/use-inbox-count';
import { loopCount } from '@/utils/plural';

import { Button } from './button';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type CaptureFormProps = {
  autoFocus?: boolean;
  /** Link to the inbox after capturing; off where the inbox comes next anyway. */
  inboxLink?: boolean;
};

/** A box for getting thoughts out of your head, one or many at a time. */
export function CaptureForm({ autoFocus = true, inboxLink = true }: CaptureFormProps) {
  const inboxCount = useInboxCount();
  const [text, setText] = useState('');
  const [lastCaptured, setLastCaptured] = useState<string | null>(null);
  const inputRef = useRef<TextInputInstance>(null);

  // More than one sentence or line reads as a brain dump: offer one loop per thought.
  const thoughts = splitBrainDump(text);
  const isBrainDump = thoughts.length > 1;

  function capture({ asOne = false } = {}) {
    if (isBrainDump && !asOne) {
      const result = captureLoops(thoughts);
      if (!result.ok) return;
      setLastCaptured(loopCount(result.value.length));
    } else {
      const result = captureLoop(text);
      if (!result.ok) return;
      setLastCaptured(`“${result.value.title}”`);
    }
    setText('');
    // Stay ready for the next thought: brain dumps come in bursts.
    inputRef.current?.focus();
  }

  return (
    <>
      <TextField
        ref={inputRef}
        testID="capture-input"
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => capture()}
        submitBehavior="submit"
        // react-native-web only reads blurOnSubmit; on phones submitBehavior overrides it.
        blurOnSubmit
        returnKeyType="done"
        placeholder="Reply to the landlord about the leak"
        multiline
        autoFocus={autoFocus}
        style={styles.input}
      />

      {isBrainDump ? (
        <ThemedView type="backgroundElement" style={styles.card} testID="brain-dump-preview">
          <ThemedText type="smallBold">That&apos;s {thoughts.length} separate thoughts:</ThemedText>
          {thoughts.map((thought, index) => (
            <ThemedText key={index} type="small" testID={`brain-dump-item-${index}`}>
              {index + 1}. {thought}
            </ThemedText>
          ))}
        </ThemedView>
      ) : null}

      <Button
        testID="capture-submit"
        label={isBrainDump ? `Add ${thoughts.length} loops` : 'Add to inbox'}
        onPress={() => capture()}
        disabled={!text.trim()}
      />
      {isBrainDump ? (
        <Button
          testID="capture-as-one"
          label="Add as one loop"
          variant="secondary"
          onPress={() => capture({ asOne: true })}
        />
      ) : null}

      {!text && !lastCaptured ? (
        <ThemedText type="small" themeColor="textSecondary">
          Tip: tap the mic on your keyboard and say everything at once. Each sentence becomes its
          own loop.
        </ThemedText>
      ) : null}

      {lastCaptured ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" testID="capture-confirmation">
            Captured {lastCaptured}
          </ThemedText>
          {inboxLink ? (
            <Link href="/inbox">
              <ThemedText type="linkPrimary">
                {loopCount(inboxCount)} in your inbox · Decide now
              </ThemedText>
            </Link>
          ) : null}
        </ThemedView>
      ) : inboxLink && inboxCount > 0 ? (
        <Link href="/inbox">
          <ThemedText type="linkPrimary">{loopCount(inboxCount)} waiting for a decision</ThemedText>
        </Link>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});

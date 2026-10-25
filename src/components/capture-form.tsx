import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { AI_SERVER_ORIGIN, AI_SERVICE } from '@/constants/ai';
import { Spacing } from '@/constants/theme';
import { captureLoop, captureLoops } from '@/db/loops';
import { MAX_SPLIT_TEXT_LENGTH, readSplit, type SplitLoop } from '@/domain/ai-split';
import { splitBrainDump } from '@/domain/brain-dump';
import { useInboxCount } from '@/hooks/use-inbox-count';
import { useAiSuggestionsEnabled } from '@/hooks/use-settings';
import { callAi } from '@/services/ai';
import { aiErrorMessage } from '@/utils/ai-messages';
import { loopCount } from '@/utils/plural';

import { Button } from './button';
import { CardAction } from './loop-card';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type CaptureFormProps = {
  autoFocus?: boolean;
  /** Link to the inbox after capturing; off where the inbox comes next anyway. */
  inboxLink?: boolean;
};

/** Below this, there's rarely more than one thought to find. */
const SMART_SPLIT_MIN_LENGTH = 40;

type SmartSplit =
  | { status: 'idle' }
  | { status: 'loading' }
  /** Loops the AI found, for exactly this text: editing the text sets them aside. */
  | { status: 'done'; forText: string; loops: SplitLoop[] }
  | { status: 'error'; message: string; detail?: string };

/** A box for getting thoughts out of your head, one or many at a time. */
export function CaptureForm({ autoFocus = true, inboxLink = true }: CaptureFormProps) {
  const inboxCount = useInboxCount();
  const aiEnabled = useAiSuggestionsEnabled() && AI_SERVER_ORIGIN !== null;
  const [text, setText] = useState('');
  const [lastCaptured, setLastCaptured] = useState<string | null>(null);
  const [smart, setSmart] = useState<SmartSplit>({ status: 'idle' });
  const inputRef = useRef<TextInputInstance>(null);

  // More than one sentence or line reads as a brain dump: offer one loop per thought.
  const thoughts = splitBrainDump(text);
  const isBrainDump = thoughts.length > 1;
  const smartLoops = smart.status === 'done' && smart.forText === text ? smart.loops : null;
  const canSplitSmartly =
    aiEnabled && text.trim().length >= SMART_SPLIT_MIN_LENGTH && text.length <= MAX_SPLIT_TEXT_LENGTH;

  async function splitSmartly() {
    const said = text;
    setSmart({ status: 'loading' });
    const result = await callAi('split', { text: said });
    const loops = result.ok ? readSplit(result.value) : null;
    if (!loops) {
      setSmart({
        status: 'error',
        message: aiErrorMessage(result.ok ? 'failed' : result.error),
        detail: result.ok ? undefined : result.detail,
      });
      return;
    }
    setSmart({ status: 'done', forText: said, loops });
  }

  function capture({ asOne = false } = {}) {
    if (smartLoops && !asOne) {
      const result = captureLoops(smartLoops);
      if (!result.ok) return;
      setLastCaptured(loopCount(result.value.length));
    } else if (isBrainDump && !asOne) {
      const result = captureLoops(thoughts.map((title) => ({ title })));
      if (!result.ok) return;
      setLastCaptured(loopCount(result.value.length));
    } else {
      const result = captureLoop(text);
      if (!result.ok) return;
      setLastCaptured(`“${result.value.title}”`);
    }
    setText('');
    setSmart({ status: 'idle' });
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

      {smartLoops ? (
        <ThemedView type="backgroundElement" style={styles.card} testID="smart-split-preview">
          <View style={styles.row}>
            <ThemedText type="smallBold" style={styles.grow}>
              {AI_SERVICE.name} found {loopCount(smartLoops.length)}:
            </ThemedText>
            <CardAction testID="smart-split-undo" label="Undo" onPress={() => setSmart({ status: 'idle' })} />
          </View>
          {smartLoops.map((loop, index) => (
            <View key={index} style={styles.smartItem} testID={`smart-split-item-${index}`}>
              <ThemedText type="small">
                {index + 1}. {loop.title}
              </ThemedText>
              {loop.notes ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.notes}>
                  “{loop.notes}”
                </ThemedText>
              ) : null}
            </View>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Your own words are kept as each loop’s notes.
          </ThemedText>
        </ThemedView>
      ) : isBrainDump ? (
        <ThemedView type="backgroundElement" style={styles.card} testID="brain-dump-preview">
          <ThemedText type="smallBold">That&apos;s {thoughts.length} separate thoughts:</ThemedText>
          {thoughts.map((thought, index) => (
            <ThemedText key={index} type="small" testID={`brain-dump-item-${index}`}>
              {index + 1}. {thought}
            </ThemedText>
          ))}
        </ThemedView>
      ) : null}

      {canSplitSmartly && !smartLoops ? (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.grow}>
            {smart.status === 'loading'
              ? `${AI_SERVICE.name} is sorting out what you said…`
              : 'Said a lot at once?'}
          </ThemedText>
          {smart.status === 'loading' ? null : (
            <CardAction testID="smart-split" label={`Split with ${AI_SERVICE.name}`} onPress={splitSmartly} />
          )}
        </View>
      ) : null}
      {smart.status === 'error' ? (
        <ThemedText type="small" themeColor="danger" testID="smart-split-error">
          {smart.message}
          {smart.detail ? ` (${smart.detail})` : ''}
        </ThemedText>
      ) : null}

      <Button
        testID="capture-submit"
        label={
          smartLoops
            ? `Add ${loopCount(smartLoops.length)}`
            : isBrainDump
              ? `Add ${thoughts.length} loops`
              : 'Add to inbox'
        }
        onPress={() => capture()}
        disabled={!text.trim()}
      />
      {isBrainDump || smartLoops ? (
        <Button
          testID="capture-as-one"
          label="Add as one loop"
          variant="secondary"
          onPress={() => capture({ asOne: true })}
        />
      ) : null}

      {!text && !lastCaptured ? (
        <ThemedText type="small" themeColor="textSecondary">
          {aiEnabled
            ? `Tip: tap the mic on your keyboard and say everything at once, then tap Split with ${AI_SERVICE.name} to turn it into separate loops.`
            : 'Tip: tap the mic on your keyboard and say everything at once. Each sentence becomes its own loop.'}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  smartItem: {
    gap: Spacing.half,
  },
  notes: {
    paddingLeft: Spacing.three,
  },
});

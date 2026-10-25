import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { captureLoop, captureLoops } from '@/db/loops';
import { splitBrainDump } from '@/domain/brain-dump';
import { useInboxCount } from '@/hooks/use-inbox-count';
import { loopCount } from '@/utils/plural';

export default function CaptureScreen() {
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
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <View style={styles.topBar}>
            <Pressable
              testID="open-settings"
              accessibilityRole="button"
              hitSlop={Spacing.three}
              onPress={() => router.push('/settings')}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="smallBold" themeColor="accent">
                Settings
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText type="subtitle">What&apos;s on your mind?</ThemedText>
          <ThemedText themeColor="textSecondary">
            Get it out of your head. You&apos;ll decide what to do with it later.
          </ThemedText>

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
            autoFocus
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
              Tip: tap the mic on your keyboard and say everything at once. Each sentence becomes
              its own loop.
            </ThemedText>
          ) : null}

          {lastCaptured ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" testID="capture-confirmation">
                Captured {lastCaptured}
              </ThemedText>
              <Link href="/inbox">
                <ThemedText type="linkPrimary">
                  {loopCount(inboxCount)} in your inbox · Decide now
                </ThemedText>
              </Link>
            </ThemedView>
          ) : inboxCount > 0 ? (
            <Link href="/inbox">
              <ThemedText type="linkPrimary">
                {loopCount(inboxCount)} waiting for a decision
              </ThemedText>
            </Link>
          ) : null}
        </ScrollView>
      </SafeAreaView>
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
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  pressed: {
    opacity: 0.7,
  },
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

import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { captureLoop } from '@/db/loops';
import { useInboxCount } from '@/hooks/use-inbox-count';
import { loopCount } from '@/utils/plural';

export default function CaptureScreen() {
  const inboxCount = useInboxCount();
  const [text, setText] = useState('');
  const [lastCaptured, setLastCaptured] = useState<string | null>(null);
  const inputRef = useRef<TextInputInstance>(null);

  function capture() {
    const result = captureLoop(text);
    if (!result.ok) return;
    setLastCaptured(result.value.title);
    setText('');
    // Stay ready for the next thought: brain dumps come in bursts.
    inputRef.current?.focus();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}>
          <ThemedText type="subtitle">What&apos;s on your mind?</ThemedText>
          <ThemedText themeColor="textSecondary">
            Get it out of your head. You&apos;ll decide what to do with it later.
          </ThemedText>

          <TextField
            ref={inputRef}
            testID="capture-input"
            value={text}
            onChangeText={setText}
            onSubmitEditing={capture}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder="Reply to the landlord about the leak"
            multiline
            autoFocus
            style={styles.input}
          />
          <Button
            testID="capture-submit"
            label="Add to inbox"
            onPress={capture}
            disabled={!text.trim()}
          />

          {lastCaptured ? (
            <ThemedView type="backgroundElement" style={styles.confirmation}>
              <ThemedText type="small" testID="capture-confirmation">
                Captured “{lastCaptured}”
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
        </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  input: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  confirmation: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});

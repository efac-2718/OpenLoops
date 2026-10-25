import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type LoopCardProps = {
  title: string;
  detail: string;
  detailColor?: ThemeColor;
  onPress: () => void;
  /** Shown at the trailing edge, such as a "Decide" label or a "Done" button. */
  action?: ReactNode;
  testID?: string;
};

export function LoopCard({ title, detail, detailColor, onPress, action, testID }: LoopCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <View style={styles.text}>
        <ThemedText>{title}</ThemedText>
        <ThemedText type="small" themeColor={detailColor ?? 'textSecondary'}>
          {detail}
        </ThemedText>
      </View>
      {action}
    </Pressable>
  );
}

type CardActionProps = {
  label: string;
  onPress?: () => void;
  testID?: string;
};

/** A compact trailing action. Without onPress it is just a label and the card handles the tap. */
export function CardAction({ label, onPress, testID }: CardActionProps) {
  const theme = useTheme();

  if (!onPress) {
    return (
      <ThemedText type="smallBold" themeColor="accent">
        {label}
      </ThemedText>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={Spacing.two}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" themeColor="accent">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  action: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});

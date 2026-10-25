import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  detail?: string;
  selected: boolean;
};

export function Chip({ label, detail, selected, ...rest }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
        },
        pressed && styles.pressed,
      ]}
      {...rest}>
      <ThemedText type="smallBold" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
      {detail ? (
        <ThemedText type="small" style={{ color: selected ? theme.onAccent : theme.textSecondary }}>
          {detail}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});

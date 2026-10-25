import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';

type ScreenHeaderProps = {
  title: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A screen's large title, with an optional line or two underneath. */
export function ScreenHeader({ title, children, style }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {children ? <ThemedText themeColor="textSecondary">{children}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
});

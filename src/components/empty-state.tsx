import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type EmptyStateProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  testID?: string;
};

export function EmptyState({ title, children, action, testID }: EmptyStateProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.empty} testID={testID}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {children}
      </ThemedText>
      {action}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
});

import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { readExportData } from '@/db/export';
import { activeQuery } from '@/db/loops';
import { setSetting } from '@/db/settings';
import { exportFileName, toJson, toMarkdown } from '@/domain/export';
import { useActiveCap } from '@/hooks/use-settings';
import { shareTextFile } from '@/services/share-file';
import { loopCount } from '@/utils/plural';

const CAP_OPTIONS = [3, 5, 7, 10];

export default function SettingsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <ActiveLimit />
          <ExportData />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function ActiveLimit() {
  const cap = useActiveCap();
  const { data: active } = useLiveQuery(activeQuery());

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Active-loop limit</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        How many next actions, scheduled loops, and loops waiting on someone you can have at once.
        A lower limit means less to hold.
      </ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {CAP_OPTIONS.map((option) => (
          <Chip
            key={option}
            testID={`cap-${option}`}
            label={String(option)}
            selected={option === cap}
            onPress={() => setSetting('active_cap', String(option))}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor={active.length > cap ? 'danger' : 'textSecondary'}>
        {active.length > cap
          ? `You have ${active.length} active now. Nothing new can become active until you finish, park, or drop ${active.length - cap + 1}.`
          : `You have ${loopCount(active.length)} active now.`}
      </ThemedText>
    </ThemedView>
  );
}

function ExportData() {
  const [status, setStatus] = useState<string | null>(null);

  async function exportAs(format: 'md' | 'json') {
    const now = new Date();
    const data = readExportData();
    const name = exportFileName(format, now);
    const result =
      format === 'md'
        ? await shareTextFile(name, toMarkdown(data.loops, now), 'text/markdown')
        : await shareTextFile(name, toJson(data, now), 'application/json');
    setStatus(result === 'shared' ? `Exported ${name}.` : 'Sharing isn’t available on this device.');
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Your data</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Everything stays on this phone. Export a copy to keep, read, or move somewhere else.
      </ThemedText>
      <Button
        testID="export-markdown"
        label="Export as Markdown"
        variant="secondary"
        onPress={() => exportAs('md')}
      />
      <Button
        testID="export-json"
        label="Export as JSON (full backup)"
        variant="secondary"
        onPress={() => exportAs('json')}
      />
      {status ? (
        <ThemedText type="small" themeColor="textSecondary" testID="export-status">
          {status}
        </ThemedText>
      ) : null}
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
    gap: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});

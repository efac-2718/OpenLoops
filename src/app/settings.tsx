import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { readExportData } from '@/db/export';
import { applyRestore, previewRestore, type RestoreSummary } from '@/db/restore';
import { activeQuery } from '@/db/loops';
import { setSetting } from '@/db/settings';
import { parseBackup, type Backup, type BackupError } from '@/domain/backup';
import { dayKey } from '@/domain/dates';
import { exportFileName, toJson, toMarkdown } from '@/domain/export';
import { useActiveCap } from '@/hooks/use-settings';
import { pickTextFile } from '@/services/pick-text-file';
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
          <RestoreData />
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

const BACKUP_ERRORS: Record<BackupError, string> = {
  not_json: 'That file isn’t a backup. Choose a .json file made with “Export as JSON”.',
  not_open_loops: 'That file isn’t an Open Loops backup.',
  newer_version: 'That backup is from a newer version of Open Loops. Update the app, then try again.',
  invalid: 'That backup is damaged, so nothing was restored.',
};

type RestoreState =
  | { stage: 'idle' }
  | { stage: 'preview'; name: string; backup: Backup; summary: RestoreSummary }
  | { stage: 'done'; summary: RestoreSummary }
  | { stage: 'error'; message: string };

function RestoreData() {
  const [state, setState] = useState<RestoreState>({ stage: 'idle' });

  async function pick() {
    let picked;
    try {
      picked = await pickTextFile();
    } catch {
      setState({ stage: 'error', message: 'That file couldn’t be opened.' });
      return;
    }
    if (!picked) return;

    const parsed = parseBackup(picked.text);
    if (!parsed.ok) {
      setState({ stage: 'error', message: BACKUP_ERRORS[parsed.error] });
      return;
    }
    setState({
      stage: 'preview',
      name: picked.name,
      backup: parsed.value,
      summary: previewRestore(parsed.value),
    });
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Restore from a backup</ThemedText>
      {state.stage === 'preview' ? (
        <RestorePreview
          {...state}
          onRestore={() => setState({ stage: 'done', summary: applyRestore(state.backup) })}
          onCancel={() => setState({ stage: 'idle' })}
        />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Choose a JSON backup to bring its loops into this phone. Nothing here is deleted: where
            both have the same loop, the one changed more recently is kept.
          </ThemedText>
          {state.stage === 'done' ? (
            <ThemedText type="small" testID="restore-status">
              Restored: {loopCount(state.summary.loops.added)} added,{' '}
              {state.summary.loops.updated} updated.
            </ThemedText>
          ) : null}
          {state.stage === 'error' ? (
            <ThemedText type="small" themeColor="danger" testID="restore-status">
              {state.message}
            </ThemedText>
          ) : null}
          <Button testID="restore-pick" label="Choose a backup file" variant="secondary" onPress={pick} />
        </>
      )}
    </ThemedView>
  );
}

function RestorePreview({
  name,
  backup,
  summary,
  onRestore,
  onCancel,
}: {
  name: string;
  backup: Backup;
  summary: RestoreSummary;
  onRestore: () => void;
  onCancel: () => void;
}) {
  const { added, updated, unchanged } = summary.loops;
  const nothingToDo = added + updated + summary.history === 0;
  const lines = [
    added > 0 ? `${loopCount(added)} to add` : null,
    updated > 0 ? `${loopCount(updated)} to replace with the backup’s newer version` : null,
    unchanged > 0 ? `${loopCount(unchanged)} already up to date` : null,
    summary.history > 0 ? `${summary.history} nightly closes, reviews, or settings to bring in` : null,
  ].filter((line) => line !== null);

  return (
    <View style={styles.preview} testID="restore-preview">
      <ThemedText type="small" themeColor="textSecondary">
        {name}
        {backup.exportedAt ? `, exported ${dayKey(backup.exportedAt)}` : ''}
      </ThemedText>
      {nothingToDo ? (
        <ThemedText type="small">Everything in this backup is already here.</ThemedText>
      ) : (
        <>
          {lines.map((line) => (
            <ThemedText key={line} type="small">
              • {line}
            </ThemedText>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Nothing on this phone will be deleted. Your reminder time stays as it is.
          </ThemedText>
          <Button testID="restore-confirm" label="Restore" onPress={onRestore} />
        </>
      )}
      <Button
        testID="restore-cancel"
        label={nothingToDo ? 'OK' : 'Cancel'}
        variant="secondary"
        onPress={onCancel}
      />
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
    gap: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  preview: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});

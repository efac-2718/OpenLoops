import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AI_SERVICE } from '@/constants/ai';
import { Spacing } from '@/constants/theme';
import { buildConcreteRequest, readConcrete } from '@/domain/ai-concrete';
import type { Loop } from '@/domain/loop';
import { callAi } from '@/services/ai';
import { aiErrorMessage } from '@/utils/ai-messages';

import { CardAction } from './loop-card';
import { ThemedText } from './themed-text';

type MakeConcreteProps = {
  loop: Pick<Loop, 'title' | 'notes'>;
  nextAction: string;
  onChange: (nextAction: string) => void;
};

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; previous: string; applied: string; reason: string }
  | { status: 'error'; message: string; detail?: string };

/** Asks the AI to turn a vague next action into one physical step, with Undo. */
export function MakeConcrete({ loop, nextAction, onChange }: MakeConcreteProps) {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function makeConcrete() {
    setState({ status: 'loading' });
    const result = await callAi('concrete', buildConcreteRequest(loop, nextAction));
    const concrete = result.ok ? readConcrete(result.value) : null;
    if (!concrete) {
      setState({
        status: 'error',
        message: aiErrorMessage(result.ok ? 'failed' : result.error),
        detail: result.ok ? undefined : result.detail,
      });
      return;
    }
    setState({ status: 'done', previous: nextAction, applied: concrete.nextAction, reason: concrete.reason });
    onChange(concrete.nextAction);
  }

  // The note and Undo apply to the AI's wording only until it is edited.
  const rewritten = state.status === 'done' && state.applied === nextAction ? state : null;

  return (
    <View style={styles.container}>
      {rewritten ? (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.text} testID="concrete-note">
            Rewritten by {AI_SERVICE.name}
            {rewritten.reason ? `: ${rewritten.reason}` : '.'}
          </ThemedText>
          <CardAction
            testID="concrete-undo"
            label="Undo"
            onPress={() => {
              onChange(rewritten.previous);
              setState({ status: 'idle' });
            }}
          />
        </View>
      ) : (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
            {state.status === 'loading'
              ? `${AI_SERVICE.name} is thinking…`
              : nextAction.trim()
                ? 'Too vague to start on?'
                : 'Not sure what the first step is?'}
          </ThemedText>
          {state.status === 'loading' ? null : (
            <CardAction
              testID="make-concrete"
              label={nextAction.trim() ? 'Make it concrete' : 'Suggest one'}
              onPress={makeConcrete}
            />
          )}
        </View>
      )}
      {state.status === 'error' ? (
        <ThemedText type="small" themeColor="danger" testID="concrete-error">
          {state.message}
          {state.detail ? ` (${state.detail})` : ''}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
  },
});

/**
 * The Android home-screen widget. The function below runs in the widget's own
 * isolated runtime, not the app: it can only use Expo UI's Jetpack Compose
 * components and must not reference anything declared outside itself.
 *
 * On Android, expo-widgets can't open the app from a widget tap, so this
 * widget only shows a summary; the app shortcuts (Capture, Tonight) open it.
 */

import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { Glance } from '@/domain/glance';

const LoopsWidget = (props: Glance, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const primary = dark ? '#FFFFFF' : '#000000';
  const secondary = dark ? '#B0B4BA' : '#60646C';
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <Column
      modifiers={[fillMaxSize(), background(dark ? '#212225' : '#F0F0F3'), cornerRadius(20), paddingAll(14)]}>
      <Text color={secondary} style={{ fontSize: 12 }}>
        Open Loops
      </Text>
      <Text color={primary} style={{ fontSize: 20, fontWeight: 'bold' }}>
        {props.inbox === 0 ? 'Inbox zero' : `${count(props.inbox, 'loop', 'loops')} to decide`}
      </Text>
      <Text color={secondary} style={{ fontSize: 13 }}>
        {props.due === 0 ? 'Nothing due today' : `${props.due} due today`}
      </Text>
      <Text color={secondary} style={{ fontSize: 13 }}>
        {props.closedToday ? 'Day closed' : 'Close the day tonight'}
      </Text>
    </Column>
  );
};

export default createWidget('LoopsWidget', LoopsWidget, { inbox: 0, due: 0, closedToday: false });

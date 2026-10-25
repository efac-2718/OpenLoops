/**
 * The nightly close reminder: a local notification repeated every day at the
 * chosen time. Local notifications need no server and work in Expo Go.
 */

import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { CloseTime } from '@/domain/reminder';

const REMINDER_ID = 'nightly-close';
const CHANNEL_ID = 'nightly-close';

export type ReminderResult = 'scheduled' | 'cancelled' | 'denied' | 'unsupported';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Replaces any existing reminder with one at `time`, or removes it when `time` is null. */
export async function setCloseReminder(time: CloseTime | null): Promise<ReminderResult> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  if (!time) return 'cancelled';

  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Nightly close',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const { granted } = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!granted) return 'denied';

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Close the day',
      body: 'Give every open loop a home before bed.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.hour,
      minute: time.minute,
      channelId: CHANNEL_ID,
    },
  });
  return 'scheduled';
}

/** Opens the nightly close when the user taps the reminder. Use inside the navigator. */
export function useOpenCloseFromReminder() {
  useEffect(() => {
    function open(notification: Notifications.Notification) {
      if (notification.request.identifier !== REMINDER_ID) return;
      router.navigate('/close');
      Notifications.clearLastNotificationResponse();
    }

    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification),
    );
    return () => subscription.remove();
  }, []);
}

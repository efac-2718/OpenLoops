/**
 * The nightly close reminder: a local notification repeated every day at the
 * chosen time. Local notifications need no server.
 *
 * Notifications are loaded on first use, and only after checking that the app
 * has their native code, so a missing piece turns the reminder off instead of
 * crashing the app.
 */

import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { CloseTime } from '@/domain/reminder';

import type { Notification } from './local-notifications';

type LocalNotifications = typeof import('./local-notifications');

const REMINDER_ID = 'nightly-close';
const CHANNEL_ID = 'nightly-close';
/** Marks notifications that open the nightly close when tapped. */
const OPENS_CLOSE = { screen: 'close' };

const CONTENT = {
  title: 'Close the day',
  body: 'Give every open loop a home before bed.',
  data: OPENS_CLOSE,
};

/** The native modules that local-notifications.ts needs. */
const REQUIRED_NATIVE_MODULES = [
  'ExpoNotificationScheduler',
  'ExpoNotificationPermissionsModule',
  'ExpoNotificationsEmitter',
  'ExpoNotificationsHandlerModule',
  ...(Platform.OS === 'android' ? ['ExpoNotificationChannelManager'] : []),
];

/** 'unavailable' means this copy of the app can't schedule notifications at all. */
export type ReminderResult = 'scheduled' | 'cancelled' | 'denied' | 'unsupported' | 'unavailable';

let loading: Promise<LocalNotifications | null> | null = null;

function loadNotifications(): Promise<LocalNotifications | null> {
  loading ??= (async () => {
    if (REQUIRED_NATIVE_MODULES.some((name) => requireOptionalNativeModule(name) === null)) {
      return null;
    }
    try {
      // A plain require, loaded only here, after the native modules are known to exist.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const notifications: LocalNotifications = require('./local-notifications');
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      return notifications;
    } catch (error) {
      console.warn('Open Loops: notifications could not be loaded.', error);
      return null;
    }
  })();
  return loading;
}

async function hasPermission(notifications: LocalNotifications): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      // Android 13+ only shows the permission prompt once a channel exists.
      await notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Nightly close',
        importance: notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      // Expo Go on Android can refuse to create channels. Reminders then go to
      // expo-notifications' fallback channel, which it creates itself.
    }
  }
  const existing = await notifications.getPermissionsAsync();
  if (existing.granted) return true;
  return (await notifications.requestPermissionsAsync()).granted;
}

/**
 * Runs a reminder action with notifications loaded. Any failure comes back as
 * 'unavailable', never as an error, so a reminder can't break the screen.
 */
async function withNotifications(
  action: (notifications: LocalNotifications) => Promise<ReminderResult>,
): Promise<ReminderResult> {
  const notifications = await loadNotifications();
  if (!notifications) return 'unavailable';
  try {
    return await action(notifications);
  } catch (error) {
    console.warn('Open Loops: the reminder could not be scheduled.', error);
    return 'unavailable';
  }
}

/** Replaces any existing reminder with one at `time`, or removes it when `time` is null. */
export function setCloseReminder(time: CloseTime | null): Promise<ReminderResult> {
  return withNotifications(async (notifications) => {
    await notifications.cancelScheduledNotificationAsync(REMINDER_ID);
    if (!time) return 'cancelled';
    if (!(await hasPermission(notifications))) return 'denied';

    await notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: CONTENT,
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
        channelId: CHANNEL_ID,
      },
    });
    return 'scheduled';
  });
}

/** Sends the reminder once, a few seconds from now, to check that reminders arrive. */
export function sendTestReminder(): Promise<ReminderResult> {
  return withNotifications(async (notifications) => {
    if (!(await hasPermission(notifications))) return 'denied';

    await notifications.scheduleNotificationAsync({
      content: CONTENT,
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: CHANNEL_ID,
      },
    });
    return 'scheduled';
  });
}

/** Opens the nightly close when the user taps the reminder. Use inside the navigator. */
export function useOpenCloseFromReminder() {
  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | undefined;

    loadNotifications().then((notifications) => {
      if (!notifications || !active) return;

      const open = (notification: Notification) => {
        if (notification.request.content.data?.screen !== OPENS_CLOSE.screen) return;
        router.navigate('/close');
        notifications.clearLastNotificationResponse();
      };

      const last = notifications.getLastNotificationResponse();
      if (last) open(last.notification);
      subscription = notifications.addNotificationResponseReceivedListener((response) =>
        open(response.notification),
      );
    }).catch((error) => {
      console.warn('Open Loops: could not listen for reminder taps.', error);
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
}

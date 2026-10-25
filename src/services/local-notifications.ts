/**
 * The local-notification parts of expo-notifications, imported file by file.
 *
 * Don't import 'expo-notifications' itself: its main entry also loads the
 * push-topic native module, which Expo Go on Android doesn't include, and that
 * crashes the app at startup. None of these files load it.
 */

export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
export {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
export {
  SchedulableTriggerInputTypes,
  type Notification,
} from 'expo-notifications/build/Notifications.types';
export {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  getLastNotificationResponse,
} from 'expo-notifications/build/NotificationsEmitter';
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';

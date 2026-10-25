/**
 * The reminder service with mockNotifications mocked, on Android, including the
 * failures seen in Expo Go: a refused notification channel, and errors thrown
 * by native code.
 */

const mockNotifications = {
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
};
const mockNativeModules = { present: true };

jest.mock('../local-notifications', () => mockNotifications);
jest.mock('expo', () => ({
  requireOptionalNativeModule: () => (mockNativeModules.present ? {} : null),
}));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

type Service = typeof import('../close-reminder');

/** A fresh copy of the service, since it remembers mockNotifications once loaded. */
function loadService(): Service {
  let service: Service | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    service = require('../close-reminder');
  });
  return service as Service;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockNativeModules.present = true;
  mockNotifications.setNotificationChannelAsync.mockResolvedValue({});
  mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: true });
  mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: true });
  mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
});

test('sends a test reminder in 5 seconds on our channel', async () => {
  await expect(loadService().sendTestReminder()).resolves.toBe('scheduled');
  expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      trigger: { type: 'timeInterval', seconds: 5, channelId: 'nightly-close' },
    }),
  );
});

test('still sends it when the channel is refused, as Expo Go on Android does', async () => {
  mockNotifications.setNotificationChannelAsync.mockRejectedValue(
    new Error("Call to function 'ExpoNotificationChannelManager.setNotificationChannelAsync' has been rejected."),
  );
  await expect(loadService().sendTestReminder()).resolves.toBe('scheduled');
  expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
});

test('schedules the nightly reminder every day at the chosen time', async () => {
  await expect(loadService().setCloseReminder({ hour: 21, minute: 30 })).resolves.toBe('scheduled');
  expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('nightly-close');
  expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: 'nightly-close',
      trigger: { type: 'daily', hour: 21, minute: 30, channelId: 'nightly-close' },
    }),
  );
});

test('turning it off only cancels, without asking for permission', async () => {
  await expect(loadService().setCloseReminder(null)).resolves.toBe('cancelled');
  expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('asks for permission, and schedules nothing when refused', async () => {
  mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false });
  mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: false });
  await expect(loadService().sendTestReminder()).resolves.toBe('denied');
  expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('reports unavailable, instead of throwing, when native code fails', async () => {
  mockNotifications.scheduleNotificationAsync.mockRejectedValue(new Error('NullPointerException'));
  await expect(loadService().sendTestReminder()).resolves.toBe('unavailable');
  await expect(loadService().setCloseReminder({ hour: 21, minute: 0 })).resolves.toBe('unavailable');
});

test('never loads mockNotifications when their native modules are missing', async () => {
  mockNativeModules.present = false;
  await expect(loadService().sendTestReminder()).resolves.toBe('unavailable');
  expect(mockNotifications.setNotificationHandler).not.toHaveBeenCalled();
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

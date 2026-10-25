/**
 * Over-the-air updates. An installed build fetches new versions of the app's
 * code from EAS Update, without reinstalling. Expo Go and development builds
 * load code from the dev server instead, so there the check is unavailable.
 *
 * expo-updates is loaded only where its native module exists, so an older
 * build without it still runs.
 */

import { requireOptionalNativeModule } from 'expo';

type Updates = typeof import('expo-updates');

let updates: Updates | null | undefined;

function loadUpdates(): Updates | null {
  if (updates === undefined) {
    try {
      const usable = !__DEV__ && requireOptionalNativeModule('ExpoUpdates') !== null;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      updates = usable ? (require('expo-updates') as Updates) : null;
    } catch (error) {
      console.warn('Open Loops: updates could not be loaded.', error);
      updates = null;
    }
  }
  return updates?.isEnabled ? updates : null;
}

export type RunningVersion =
  | { source: 'dev_server' }
  | { source: 'built_in' | 'update'; publishedAt: Date | null };

/** Which version of the code is running: the one the app was built with, or a downloaded update. */
export function runningVersion(): RunningVersion {
  const loaded = loadUpdates();
  if (!loaded) return { source: 'dev_server' };
  return {
    source: loaded.isEmbeddedLaunch ? 'built_in' : 'update',
    publishedAt: loaded.createdAt,
  };
}

export type UpdateResult = 'restarting' | 'up_to_date' | 'unavailable' | 'failed';

/** Downloads a newer version if there is one, then restarts the app into it. */
export async function updateNow(): Promise<UpdateResult> {
  const loaded = loadUpdates();
  if (!loaded) return 'unavailable';
  try {
    const check = await loaded.checkForUpdateAsync();
    if (!check.isAvailable) return 'up_to_date';
    const fetched = await loaded.fetchUpdateAsync();
    if (!fetched.isNew) return 'up_to_date';
    await loaded.reloadAsync();
    return 'restarting';
  } catch (error) {
    console.warn('Open Loops: the update check failed.', error);
    return 'failed';
  }
}

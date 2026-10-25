// The web version always loads the latest code, so there's nothing to update.

import type { RunningVersion, UpdateResult } from './app-updates';

export function runningVersion(): RunningVersion {
  return { source: 'dev_server' };
}

export async function updateNow(): Promise<UpdateResult> {
  return 'unavailable';
}

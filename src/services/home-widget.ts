/**
 * Keeps the home-screen widget showing the latest summary.
 *
 * The widget module is loaded only where its native code exists (an installed
 * build, not Expo Go), so the app runs the same everywhere.
 */

import { requireOptionalNativeModule } from 'expo';

import type { Glance } from '@/domain/glance';

type LoopsWidget = typeof import('@/widgets/loops-widget').default;

let widget: LoopsWidget | null | undefined;

function loadWidget(): LoopsWidget | null {
  if (widget === undefined) {
    try {
      widget =
        requireOptionalNativeModule('ExpoWidgets') === null
          ? null
          : // eslint-disable-next-line @typescript-eslint/no-require-imports
            (require('@/widgets/loops-widget').default as LoopsWidget);
    } catch (error) {
      console.warn('Open Loops: the home-screen widget could not be loaded.', error);
      widget = null;
    }
  }
  return widget;
}

export function updateHomeWidget(summary: Glance): void {
  try {
    loadWidget()?.updateSnapshot(summary);
  } catch (error) {
    console.warn('Open Loops: the home-screen widget could not be updated.', error);
  }
}

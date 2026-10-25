/**
 * Adds Android app shortcuts: long-press the app icon for "Capture" and
 * "Tonight", or drag one onto the home screen as its own icon. Each opens a
 * screen through the app's deep-link scheme, which Expo Router handles.
 */

const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require('expo/config-plugins');

const SHORTCUTS = [
  { id: 'capture', shortLabel: 'Capture', longLabel: 'Capture a thought', route: '' },
  { id: 'tonight', shortLabel: 'Tonight', longLabel: 'Close the day', route: 'close' },
];

function shortcutsXml(scheme, packageName) {
  const items = SHORTCUTS.map(
    ({ id, route }) => `  <shortcut
    android:shortcutId="${id}"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/shortcut_${id}_short"
    android:shortcutLongLabel="@string/shortcut_${id}_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity"
      android:data="${scheme}:///${route}" />
  </shortcut>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${items.join('\n')}
</shortcuts>
`;
}

module.exports = function withAndroidShortcuts(config) {
  const scheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  const packageName = config.android?.package;
  if (!scheme || !packageName) {
    throw new Error('with-android-shortcuts needs expo.scheme and expo.android.package in app.json');
  }

  config = withStringsXml(config, (mod) => {
    const items = SHORTCUTS.flatMap(({ id, shortLabel, longLabel }) => [
      AndroidConfig.Resources.buildResourceItem({ name: `shortcut_${id}_short`, value: shortLabel }),
      AndroidConfig.Resources.buildResourceItem({ name: `shortcut_${id}_long`, value: longLabel }),
    ]);
    mod.modResults = AndroidConfig.Strings.setStringItem(items, mod.modResults);
    return mod;
  });

  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const xmlDir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(path.join(xmlDir, 'shortcuts.xml'), shortcutsXml(scheme, packageName));
      return mod;
    },
  ]);

  config = withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const metaData = (activity['meta-data'] ?? []).filter(
      (item) => item.$['android:name'] !== 'android.app.shortcuts',
    );
    metaData.push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    activity['meta-data'] = metaData;
    return mod;
  });

  return config;
};

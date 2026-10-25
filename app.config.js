/**
 * app.json holds the app's settings. This file only changes them for a
 * development build (APP_VARIANT=development, set in eas.json and by
 * `npm run dev`): it becomes a separate app, "Open Loops Dev", with its own id,
 * link scheme and data, so it can sit next to the real app without touching
 * your loops.
 */

const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => {
  if (!IS_DEV) return config;
  return {
    ...config,
    name: `${config.name} Dev`,
    scheme: `${config.scheme}-dev`,
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.dev` },
    android: { ...config.android, package: `${config.android.package}.dev` },
  };
};

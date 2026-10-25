/**
 * app.json holds the app's settings. This file changes them in two cases:
 *
 * - A development build (APP_VARIANT=development, set in eas.json and by
 *   `npm run dev`) becomes a separate app, "Open Loops Dev", with its own id,
 *   link scheme and data, so it can sit next to the real app without touching
 *   your loops.
 * - The AI server export (OPEN_LOOPS_API=1, set by .eas/workflows/deploy-api.yml)
 *   switches the web output to "server", so the API routes in src/app/api are
 *   bundled for EAS Hosting. Only that export changes it: the app's runtime
 *   version is a fingerprint of this config, so changing it for everyone would
 *   stop updates from reaching the installed app.
 */

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_API_EXPORT = process.env.OPEN_LOOPS_API === '1';

module.exports = ({ config }) => {
  if (IS_API_EXPORT) {
    config = { ...config, web: { ...config.web, output: 'server' } };
  }
  if (!IS_DEV) return config;
  return {
    ...config,
    name: `${config.name} Dev`,
    scheme: `${config.scheme}-dev`,
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.dev` },
    android: { ...config.android, package: `${config.android.package}.dev` },
  };
};

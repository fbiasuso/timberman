import { version } from '../../package.json';

/**
 * Single source of truth for the app version, read from `client/package.json`
 * (D3). Used by the APK packaging and as the hook for a future forced-update
 * check against a server minimum version. Bump `client/package.json` version
 * on every release.
 */
export const APP_VERSION: string = version;

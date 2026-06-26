// Polyfill for Sentry/Bridgeless mode detection issues in some RN versions
// MUST be the very first thing to run before any other imports
import { LogBox } from 'react-native';

const g = (globalThis as any);
if (typeof g.RN$Bridgeless === 'undefined') {
  g.RN$Bridgeless = false;
}
if (typeof g.global === 'undefined') {
  g.global = g;
}

// Suppress harmless Android lifecycle errors from ExpoKeepAwake / foreground service.
// These fire when the OS tries to start a foreground service while the activity is
// transitioning. They are non-fatal and self-recover on next foreground resume.
const SUPPRESSED_SUBSTRINGS = [
  'ExpoKeepAwake',
  'expo-keep-awake',
  'activity is no longer available',
  'no longer available',
  "Couldn't start the foreground service",
  'Foreground service cannot be started when the application is in the background',
  'Call to function',
  'has been rejected',
];

const errorText = (err: unknown): string => {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  const e = err as { message?: string; cause?: unknown };
  const parts = [e.message, errorText(e.cause)];
  try {
    parts.push(JSON.stringify(err));
  } catch {
    // ignore circular refs
  }
  return parts.filter(Boolean).join(' ');
};

const isSuppressed = (err: unknown): boolean => {
  const msg = errorText(err);
  return SUPPRESSED_SUBSTRINGS.some((s) => msg.includes(s));
};

LogBox.ignoreLogs(SUPPRESSED_SUBSTRINGS);

// 1. React Native global error handler (catches fatal JS errors)
const _originalHandler = g.ErrorUtils?.getGlobalHandler?.();
if (g.ErrorUtils) {
  g.ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    if (isSuppressed(error)) {
      console.warn('[GlobalErrorHandler] Suppressed harmless lifecycle error:', error?.message);
      return;
    }
    _originalHandler?.(error, isFatal);
  });
}

// 2. Promise rejection tracker override (catches unhandled promise rejections).
// RN uses the `promise` polyfill which calls onUnhandled — we intercept it here
// before it reaches ExceptionsManager.handleException (promiseRejectionTrackingOptions.js).
const installRejectionHandler = (): void => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: number, error: unknown) => {
        if (isSuppressed(error)) {
          console.warn(
            '[RejectionTracker] Suppressed harmless lifecycle rejection:',
            errorText(error) || id,
          );
          return;
        }
        const message = errorText(error) || `id: ${id}`;
        console.error(`Possible Unhandled Promise Rejection (id: ${id}):\n${message}`);
      },
      onHandled: () => {},
    });
  } catch {
    // Module not available — safe to ignore
  }
};

installRejectionHandler();
// Re-apply after expo-dev-client / other libs register their handlers
setTimeout(installRejectionHandler, 0);

export {};

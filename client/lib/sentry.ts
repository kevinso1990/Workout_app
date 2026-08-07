/**
 * Client crash + error reporting via Sentry.
 *
 * Activates ONLY when EXPO_PUBLIC_SENTRY_DSN is set. Until then the native
 * `@sentry/react-native` module is never loaded, so a dev client built before
 * Sentry was added keeps working unchanged. The require is also wrapped in a
 * try/catch so a missing native module (DSN set but app not yet rebuilt with
 * the native SDK) degrades to a warning instead of crashing the app.
 *
 * To turn it on: create a Sentry project, set EXPO_PUBLIC_SENTRY_DSN, and ship
 * a new native build (the native module is linked at build time).
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/react-native");
    Sentry.init({
      dsn,
      environment: __DEV__ ? "development" : "production",
      // Light tracing; primary goal is crash/error visibility.
      tracesSampleRate: 0.05,
    });
  } catch (e) {
    console.warn("[sentry] init skipped:", (e as Error)?.message);
  }
}

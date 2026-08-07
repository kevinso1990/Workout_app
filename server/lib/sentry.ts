import * as Sentry from "@sentry/node";

let enabled = false;

/**
 * Initialises Sentry error reporting when SENTRY_DSN is set. No-ops otherwise,
 * so the server runs identically in dev / on machines without a DSN. Call this
 * once, as early as possible in process startup.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "production",
    // Keep tracing light; this is primarily for crash/error visibility.
    tracesSampleRate: 0.05,
  });
  enabled = true;
  console.log("[sentry] server error reporting enabled");
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/** Reports a fatal error, then resolves once buffered events are flushed. */
export async function captureFatalAndFlush(err: unknown, context: string): Promise<void> {
  if (!enabled) return;
  try {
    Sentry.captureException(err, { tags: { context } });
    await Sentry.close(2000);
  } catch {
    /* never let error reporting block the exit path */
  }
}

export { Sentry };

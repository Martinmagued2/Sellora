// Edge runtime Sentry config — lighter weight, dynamic import.

let _initialized = false;

export async function registerEdgeSentry() {
  if (_initialized) return;
  _initialized = true;

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    const Sentry = (await import("@sentry/nextjs")).default;
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
      sendDefaultPii: false,
    });
  } catch (e) {
    // Package not installed — Sentry is disabled
  }
}

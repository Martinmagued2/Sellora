/**
 * Sentry initialization — only activates if:
 *   1. @sentry/nextjs is installed, AND
 *   2. NEXT_PUBLIC_SENTRY_DSN is set
 *
 * To enable: npm install @sentry/nextjs, then set:
 *   NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
 */

let Sentry = null;
let _initialized = false;

async function loadSentry() {
  if (Sentry !== null) return Sentry;
  try {
    Sentry = (await import("@sentry/nextjs")).default;
  } catch (e) {
    // Package not installed — Sentry is disabled
    Sentry = false;
  }
  return Sentry;
}

export async function registerSentry() {
  if (_initialized) return;
  _initialized = true;

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const sentry = await loadSentry();
  if (!sentry) return;

  sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.NODE_ENV,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "AbortError",
    ],
    sendDefaultPii: false,
    release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
  });
}

/** Capture an exception — no-op if Sentry isn't configured */
export async function captureException(err, extra = {}) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const sentry = await loadSentry();
  if (sentry) sentry.captureException(err, { extra });
}

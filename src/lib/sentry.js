import * as Sentry from "@sentry/nextjs";

/**
 * Sentry initialization — only activates if NEXT_PUBLIC_SENTRY_DSN is set.
 *
 * To enable: npm install @sentry/nextjs, then set these env vars:
 *   NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
 *   SENTRY_AUTH_TOKEN=your-token (for source map uploads)
 */
export function registerSentry() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.NODE_ENV,
    // Filter out noisy errors
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "AbortError",
    ],
    // Don't send PII
    sendDefaultPii: false,
    // Release tracking (set SENTRY_RELEASE in Vercel)
    release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
  });
}

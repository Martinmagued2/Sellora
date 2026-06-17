import * as Sentry from "@sentry/nextjs";

// Edge runtime Sentry config (lighter weight)
export function registerEdgeSentry() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
  });
}

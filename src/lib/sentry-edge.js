/**
 * Edge runtime Sentry config — currently a no-op.
 *
 * Sentry is not installed in this project. This file exists so that
 * `instrumentation.js` imports don't break the build.
 *
 * To enable Sentry on edge runtime later:
 *   1. npm install @sentry/nextjs
 *   2. Set NEXT_PUBLIC_SENTRY_DSN env var
 *   3. Replace this file with the real init code (see git history)
 */

export async function registerEdgeSentry() {
  // No-op until @sentry/nextjs is installed
  return;
}

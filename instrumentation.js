// Sentry instrumentation file.
//
// Sentry is NOT installed in this project. These functions are no-ops
// so the build doesn't break. To enable Sentry:
//   1. npm install @sentry/nextjs
//   2. Set NEXT_PUBLIC_SENTRY_DSN env var
//   3. Restore the real init code in src/lib/sentry.js and src/lib/sentry-edge.js

export async function register() {
  // No-op — Sentry not installed
}

export async function onRequestError(_err, _request) {
  // No-op — Sentry not installed
}

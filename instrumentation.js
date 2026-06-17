// Sentry instrumentation file — required by @sentry/nextjs for auto-init.
// Uses dynamic imports so the build doesn't fail if @sentry/nextjs isn't installed.

export async function register() {
  // Skip if Sentry isn't configured
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const { registerSentry } = await import("@/lib/sentry");
      await registerSentry();
    } else if (process.env.NEXT_RUNTIME === "edge") {
      const { registerEdgeSentry } = await import("@/lib/sentry-edge");
      registerEdgeSentry();
    }
  } catch (e) {
    // Sentry not installed — silently skip
    console.warn("[instrumentation] Sentry skipped:", e.message);
  }
}

export async function onRequestError(err, request) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const { captureException } = await import("@/lib/sentry");
    await captureException(err, { path: request?.path, method: request?.method });
  } catch (e) {
    // Silent fail
  }
}

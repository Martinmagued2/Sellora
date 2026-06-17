// Sentry instrumentation file — required by @sentry/nextjs for auto-init
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerSentry } = await import("@/lib/sentry");
    registerSentry();
  } else if (process.env.NEXT_RUNTIME === "edge") {
    const { registerEdgeSentry } = await import("@/lib/sentry-edge");
    registerEdgeSentry();
  }
}

export async function onRequestError(err, request) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err, {
      extra: { path: request.path, method: request.method },
    });
  }
}

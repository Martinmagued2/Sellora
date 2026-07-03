/**
 * Structured logger — replaces console.log in production code.
 *
 * - In development: pretty-prints to stdout
 * - In production: emits JSON (one line per event) for log aggregators
 * - If Sentry is configured, errors are also captured
 *
 * Usage:
 *   import { logInfo, logError, logWarn } from "@/lib/logger";
 *   logInfo("user signed in", { userId: "..." });
 *   logError("payment failed", err, { orderId: "..." });
 */

const isProd = process.env.NODE_ENV === "production";

// Sentry is not installed in this project. To enable it:
//   1. npm install @sentry/nextjs
//   2. Set NEXT_PUBLIC_SENTRY_DSN env var
//   3. Restore the dynamic import of @sentry/nextjs in getSentry()
async function getSentry() {
  return false;
}

function emit(level, msg, meta = {}, err = null) {
  const payload = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...meta,
  };
  if (err) {
    payload.error = err.message;
    payload.stack = err.stack;
  }

  if (isProd) {
    // One-line JSON for log aggregators (Datadog, Logflare, etc.)
    const line = JSON.stringify(payload);
    if (level === "error") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
  } else {
    // Dev: pretty print
    const prefix = `[${payload.ts.slice(11, 19)}] ${level.toUpperCase()}`;
    if (level === "error") {
      console.error(prefix, msg, meta, err || "");
    } else if (level === "warn") {
      console.warn(prefix, msg, meta);
    } else {
      console.log(prefix, msg, meta);
    }
  }

  // Forward to Sentry (no-op until installed)
  if (level === "error" && err) {
    getSentry().then((s) => {
      if (s) s.captureException(err, { extra: meta });
    });
  }
}

export function logInfo(msg, meta = {}) {
  emit("info", msg, meta);
}

export function logWarn(msg, meta = {}) {
  emit("warn", msg, meta);
}

export function logError(msg, err = null, meta = {}) {
  emit("error", msg, meta, err);
}

// Debug only enabled if DEBUG=1 or NODE_ENV=development
export function logDebug(msg, meta = {}) {
  if (process.env.DEBUG === "1" || !isProd) {
    emit("debug", msg, meta);
  }
}

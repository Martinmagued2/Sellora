/**
 * API Route Wrappers — eliminate boilerplate
 *
 * Usage:
 *   export const POST = withAuth(async (req, ctx) => {
 *     const { user, admin } = ctx;
 *     // ... actual handler logic
 *   });
 *
 *   export const POST = withAdmin(async (req, ctx) => { ... }); // admin-only
 *   export const POST = withPublic(async (req, ctx) => { ... }); // no auth
 *   export const POST = withCron(async (req, ctx) => { ... }); // CRON_SECRET
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { logError, logInfo } from "@/lib/logger";

let _adminClient = null;
export function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export function withAuth(handler, opts = {}) {
  return async (req, ctx) => {
    const startedAt = Date.now();
    const path = new URL(req.url).pathname;
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const admin = getAdminClient();
      const handlerCtx = { user, admin, userId: user.id };

      if (opts.loadAccount) {
        const { data: account, error } = await admin
          .from("accounts")
          .select("*")
          .eq("id", user.id)
          .single();
        if (error || !account) {
          return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }
        handlerCtx.account = account;
        handlerCtx.plan = account.plan || "starter";
      }

      return await handler(req, handlerCtx);
    } catch (err) {
      logError(`[API] ${req.method} ${path}`, err);
      return NextResponse.json(
        { error: "Server error", message: process.env.NODE_ENV === "development" ? err.message : undefined },
        { status: 500 }
      );
    } finally {
      const ms = Date.now() - startedAt;
      if (ms > 1000) logInfo(`[API] slow ${req.method} ${path} took ${ms}ms`);
    }
  };
}

export function withAdmin(handler) {
  return withAuth(async (req, ctx) => {
    if (ctx.account?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return handler(req, ctx);
  }, { loadAccount: true });
}

export function withPublic(handler) {
  return async (req, ctx) => {
    const startedAt = Date.now();
    const path = new URL(req.url).pathname;
    try {
      return await handler(req, { admin: getAdminClient(), ...ctx });
    } catch (err) {
      logError(`[API] ${req.method} ${path}`, err);
      return NextResponse.json(
        { error: "Server error", message: process.env.NODE_ENV === "development" ? err.message : undefined },
        { status: 500 }
      );
    }
  };
}

export function withCron(handler) {
  return async (req, ctx) => {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return withPublic(handler)(req, ctx);
  };
}

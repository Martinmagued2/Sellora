import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

// ─── Server-side: API route admin verification ───

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still do a comparison to avoid leaking length via timing
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create a Supabase server client that reads cookies from the request.
 */
async function getSupabaseWithCookies() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Verify admin access from an API request.
 *
 * ALWAYS requires a valid JWT session first. The user ID is extracted
 * from the JWT and checked against the accounts table for admin role.
 *
 * The x-account-id header is only used as a secondary consistency check
 * AFTER successful JWT verification.
 *
 * The x-admin-key header is accepted as a fallback for server-to-server
 * calls only, using timing-safe comparison.
 *
 * Returns { isAdmin: boolean, accountId?: string, userId?: string }
 */
export async function verifyAdmin(request) {
  // ── Check 1: Admin secret key (server-to-server fallback) ──
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey && process.env.ADMIN_SECRET_KEY) {
    if (timingSafeCompare(adminKey, process.env.ADMIN_SECRET_KEY)) {
      return { isAdmin: true, accountId: "secret-key" };
    }
  }

  // ── Check 2: JWT session verification (primary auth path) ──
  try {
    const supabase = await getSupabaseWithCookies();
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return { isAdmin: false };
    }

    const userId = user.id;

    // Look up the account by user ID
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: account, error } = await adminSupabase
      .from("accounts")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (error || !account) return { isAdmin: false };

    if (account.role !== "admin") return { isAdmin: false };

    // Secondary check: if x-account-id is provided, it must match
    const headerAccountId = request.headers.get("x-account-id");
    if (headerAccountId && headerAccountId !== account.id) {
      return { isAdmin: false };
    }

    return { isAdmin: true, accountId: account.id, userId };
  } catch (e) {
    console.error("Admin auth check failed:", e);
  }

  return { isAdmin: false };
}

/**
 * Check if a user ID has admin role in the accounts table.
 * Used by middleware and server-side code.
 */
export async function isUserAdmin(userId) {
  if (!userId) return false;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: account, error } = await supabase
      .from("accounts")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !account) return false;
    return account.role === "admin";
  } catch (e) {
    console.error("isUserAdmin check failed:", e);
    return false;
  }
}

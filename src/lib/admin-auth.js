import { createClient } from "@supabase/supabase-js";

// ─── Server-side: API route admin verification ───

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * Verify admin access from an API request.
 * Checks in order:
 *   1. x-admin-key header matches ADMIN_SECRET_KEY env var
 *   2. Account with x-account-id header has role = 'admin' in DB
 *
 * Returns { isAdmin: boolean, accountId?: string }
 */
export async function verifyAdmin(request) {
  // Check 1: Admin secret key
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey && adminKey === process.env.ADMIN_SECRET_KEY) {
    return { isAdmin: true, accountId: "secret-key" };
  }

  // Check 2: Account ID with admin role in DB
  const accountId = request.headers.get("x-account-id");
  if (!accountId) return { isAdmin: false };

  try {
    const supabase = getSupabase();
    const { data: account, error } = await supabase
      .from("accounts")
      .select("id, role")
      .eq("id", accountId)
      .single();

    if (error || !account) return { isAdmin: false };
    if (account.role === "admin") return { isAdmin: true, accountId: account.id };
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
    const supabase = getSupabase();
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

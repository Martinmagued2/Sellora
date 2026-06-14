import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Shared Supabase service role client (lazy-initialized).
 * Bypasses RLS — use for all data operations in API routes.
 */
let _serviceClient = null;
export function getServiceRoleClient() {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _serviceClient;
}

/**
 * Get authenticated user from either:
 *   1. Bearer token in Authorization header (preferred, most reliable)
 *   2. Cookie-based session (fallback)
 *
 * Returns the user object or null if not authenticated.
 */
export async function getAuthUser(req) {
  // ── Method 1: Bearer token ──
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const supabase = getServiceRoleClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        return data.user;
      }
    } catch (err) {
      // Fall through to cookie auth
    }
  }

  // ── Method 2: Cookie-based session ──
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    if (!allCookies || allCookies.length === 0) {
      return null;
    }

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return allCookies;
          },
          setAll() {
            // No-op in API route — we don't need to set cookies
          },
        },
      }
    );

    const { data, error } = await supabaseAuth.auth.getUser();
    if (error || !data?.user) {
      return null;
    }

    return data.user;
  } catch (err) {
    return null;
  }
}

/**
 * Per-request Supabase client using the user's JWT.
 *
 * WHY
 * The service role key bypasses RLS — every route that uses it must
 * remember to add `.eq("account_id", user.id)` to every query. A single
 * forgotten filter = full data leak across all tenants.
 *
 * Using the user's JWT instead means RLS policies actually apply. A query
 * without a filter simply returns zero rows (because RLS blocks cross-tenant
 * access at the database level).
 *
 * USAGE
 *   import { getUserSupabaseClient } from "@/lib/supabase/user-client";
 *   const supabase = await getUserSupabaseClient(req);
 *   if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *   const { data } = await supabase.from("customers").select("*");
 *   // RLS automatically scopes to the user's account_id — no .eq() needed
 *
 * WHEN TO USE
 * - Use this for ALL user-facing API routes (anything that has a logged-in user).
 * - Keep using the service role client for:
 *   - Webhooks (no user session)
 *   - Cron jobs (no user session)
 *   - OAuth callbacks (when the user session is being established)
 *   - Cross-account admin operations
 *
 * MIGRATION PATH
 * Routes can be migrated incrementally. This file exists as the target
 * infrastructure — individual routes should be migrated one at a time
 * with careful testing.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth-helper";

/**
 * Get a Supabase client scoped to the authenticated user's session.
 * RLS policies will apply to all queries made through this client.
 *
 * @param {Request} req
 * @returns {Promise<{ client: import("@supabase/supabase-js").SupabaseClient, user: { id, email } } | null>}
 *   Returns null if the user is not authenticated.
 */
export async function getUserSupabaseClient(req) {
  const user = await getAuthUser(req);
  if (!user) return null;

  try {
    const cookieStore = await cookies();
    const client = createServerClient(
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
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    );

    return { client, user };
  } catch (e) {
    console.warn("[USER-CLIENT] Failed to create user-scoped client:", e.message);
    return null;
  }
}

/**
 * Get the authenticated user's ID without creating a full Supabase client.
 * Use this when you only need to check auth, not run queries.
 *
 * @param {Request} req
 * @returns {Promise<{ id: string, email: string } | null>}
 */
export async function getAuthenticatedUser(req) {
  const user = await getAuthUser(req);
  if (!user) return null;
  return { id: user.id, email: user.email };
}

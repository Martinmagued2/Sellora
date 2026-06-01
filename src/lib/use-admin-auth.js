"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side hook to check if the current logged-in user is an admin.
 * Fetches the user's role from the accounts table.
 *
 * Returns { isAdmin: boolean | null, loading: boolean, userId: string | null }
 *   - isAdmin is null while loading, true/false after check
 */
export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setUserId(user.id);

        const { data: account, error } = await supabase
          .from("accounts")
          .select("role")
          .eq("id", user.id)
          .single();

        // If the role column doesn't exist yet (migration not run),
        // the query will error. Gracefully handle this.
        if (error) {
          // Column might not exist — check the error code
          // 42703 = undefined_column, 42P01 = undefined_table
          if (error.code === "42703" || error.code === "42P01" || error.message?.includes("role")) {
            console.info("[useAdminAuth] Role column not found in accounts table. Run migration 006 to add it.");
          } else {
            console.warn("[useAdminAuth] Error checking admin role:", error.message);
          }
          setIsAdmin(false);
        } else if (account && account.role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        console.error("useAdminAuth error:", e);
        setIsAdmin(false);
      }
      setLoading(false);
    };

    checkAdmin();
  }, []);

  return { isAdmin, loading, userId };
}

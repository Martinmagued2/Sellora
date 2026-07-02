"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const EffectiveAccountContext = createContext(null);

/**
 * Resolves the "effective account ID" for the current user.
 * 
 * - If the user is a store owner → returns their own user.id
 * - If the user is a team member (agent/admin) → returns the owner's account_id
 *   from the team_members table
 * 
 * This lets team members see the owner's conversations, orders, products, etc.
 */
export function EffectiveAccountProvider({ children }) {
  const [effectiveAccountId, setEffectiveAccountId] = useState(null);
  const [role, setRole] = useState("owner");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const resolve = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Check if this user is a team member (agent/admin under someone else's account)
        const { data: teamMember } = await supabase
          .from("team_members")
          .select("account_id, role, invite_status")
          .eq("user_id", user.id)
          .eq("invite_status", "accepted")
          .maybeSingle();

        if (teamMember?.account_id) {
          // Team member — use the owner's account ID
          setEffectiveAccountId(teamMember.account_id);
          setRole(teamMember.role || "agent");
        } else {
          // Store owner — use their own ID
          setEffectiveAccountId(user.id);
          setRole("owner");
        }
      } catch (e) {
        console.error("[EffectiveAccount] Error:", e);
      } finally {
        setLoading(false);
      }
    };
    resolve();
  }, []);

  return (
    <EffectiveAccountContext.Provider value={{ effectiveAccountId, role, loading }}>
      {children}
    </EffectiveAccountContext.Provider>
  );
}

export function useEffectiveAccount() {
  const ctx = useContext(EffectiveAccountContext);
  if (!ctx) {
    // Fallback — return null, pages should handle this
    return { effectiveAccountId: null, role: "owner", loading: true };
  }
  return ctx;
}

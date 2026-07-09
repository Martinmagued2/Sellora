/**
 * Install Bonus API
 * POST /api/onboarding/install-bonus
 *
 * Called when the user accepts the PWA install prompt.
 * Credits the account with 50 bonus AI replies by storing a metadata flag.
 * Idempotent — only credits once per account.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdminClient();

    // Check if already credited (idempotent)
    const { data: account } = await admin
      .from("accounts")
      .select("id, metadata, onboarding_steps")
      .eq("id", user.id)
      .single();

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const metadata = account.metadata || {};
    if (metadata.install_bonus_credited) {
      return NextResponse.json({ success: true, alreadyCredited: true });
    }

    // Credit the account
    metadata.install_bonus_credited = true;
    metadata.install_bonus_at = new Date().toISOString();
    metadata.install_bonus_amount = 50; // 50 bonus AI replies

    await admin
      .from("accounts")
      .update({ metadata })
      .eq("id", user.id);

    // Insert a notification
    await admin.from("notifications").insert({
      account_id: user.id,
      type: "install_bonus",
      title: "🎁 50 bonus AI replies credited!",
      body: "Thanks for installing Sellora! You've been credited with 50 bonus AI replies for this month.",
      link: "/dashboard",
    });

    return NextResponse.json({ success: true, bonusReplies: 50 });
  } catch (err) {
    console.error("[INSTALL-BONUS] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

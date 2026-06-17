/**
 * Onboarding API
 *
 * GET  /api/onboarding            — returns the user's checklist state + computed steps
 * POST /api/onboarding/complete   — body: { step: "connect_whatsapp" | "add_product" | ... }
 *                                   marks a step complete + returns updated state
 *
 * The 5 canonical onboarding steps:
 *   1. connect_whatsapp   — verified by accounts.whatsapp_connected = true
 *   2. add_product        — verified by products table having >= 1 row
 *   3. set_ai_personality — verified by accounts.ai_personality != default
 *   4. send_test_msg      — verified by messages table having >= 1 outgoing AI msg
 *   5. invite_teammate    — verified by team_members table having >= 1 row
 *
 * The API auto-derives "completed" status from these queries rather than
 * trusting client-reported state, so it stays accurate even if the user
 * takes actions outside the checklist UI.
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

const STEPS = [
  {
    key: "connect_whatsapp",
    title: "Connect WhatsApp",
    description: "Link your WhatsApp Business number to start receiving messages",
    href: "/dashboard/settings?tab=channels",
    icon: "whatsapp",
  },
  {
    key: "add_product",
    title: "Add your first product",
    description: "Add at least one product to your catalog so the AI can sell it",
    href: "/dashboard/products",
    icon: "product",
  },
  {
    key: "set_ai_personality",
    title: "Customize your AI",
    description: "Tune your AI agent's tone and personality for your brand",
    href: "/dashboard/ai-personality",
    icon: "ai",
  },
  {
    key: "send_test_msg",
    title: "Send a test message",
    description: "Try out the AI copilot to see how it replies to customers",
    href: "/dashboard/conversations",
    icon: "chat",
  },
  {
    key: "invite_teammate",
    title: "Invite a teammate",
    description: "Bring your team in to help handle conversations (Pro+)",
    href: "/dashboard/settings?tab=team",
    icon: "team",
  },
];

async function computeStepState(admin, userId) {
  // 1. connect_whatsapp
  const { data: account } = await admin
    .from("accounts")
    .select("whatsapp_connected, ai_personality, plan")
    .eq("id", userId)
    .single();

  // 2. add_product
  const { count: productCount } = await admin
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("account_id", userId);

  // 3. set_ai_personality (non-default)
  const defaultPersonality = "Friendly, professional, and helpful. Use emojis sparingly.";
  const personalitySet = account?.ai_personality && account.ai_personality.trim() !== defaultPersonality.trim();

  // 4. send_test_msg — has the account sent any AI message?
  const { count: aiMsgCount } = await admin
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("account_id", userId)
    .eq("is_ai", true);

  // 5. invite_teammate
  const { count: teamCount } = await admin
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("account_id", userId);

  return {
    connect_whatsapp: account?.whatsapp_connected === true,
    add_product: (productCount || 0) >= 1,
    set_ai_personality: personalitySet === true,
    send_test_msg: (aiMsgCount || 0) >= 1,
    invite_teammate: (teamCount || 0) >= 1,
  };
}

/** GET /api/onboarding */
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdminClient();
    const computed = await computeStepState(admin, user.id);

    // Merge with stored onboarding_steps (in case we want to track additional manual steps)
    const { data: account } = await admin
      .from("accounts")
      .select("onboarding_steps, onboarding_completed_at, plan")
      .eq("id", user.id)
      .single();

    const stored = account?.onboarding_steps || {};
    // Computed takes precedence (source of truth)
    const merged = { ...stored, ...computed };

    const completedCount = Object.values(merged).filter(Boolean).length;
    const totalCount = STEPS.length;
    const isComplete = completedCount === totalCount;
    const progressPct = Math.round((completedCount / totalCount) * 100);

    // If all complete and we haven't recorded completion yet, do it now
    if (isComplete && !account?.onboarding_completed_at) {
      await admin
        .from("accounts")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    return NextResponse.json({
      steps: STEPS.map((s) => ({ ...s, completed: !!merged[s.key] })),
      progress: { completed: completedCount, total: totalCount, percent: progressPct, isComplete },
      completedAt: account?.onboarding_completed_at || null,
      plan: account?.plan || "starter",
    });
  } catch (err) {
    console.error("[ONBOARDING] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/onboarding/complete — manually mark a step complete (e.g. user clicked "Skip") */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { step } = await req.json();
    if (!step || !STEPS.find((s) => s.key === step)) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: account } = await admin
      .from("accounts")
      .select("onboarding_steps")
      .eq("id", user.id)
      .single();

    const stored = account?.onboarding_steps || {};
    stored[step] = true;

    await admin
      .from("accounts")
      .update({ onboarding_steps: stored })
      .eq("id", user.id);

    // Re-compute full state
    const computed = await computeStepState(admin, user.id);
    const merged = { ...stored, ...computed };
    const completedCount = Object.values(merged).filter(Boolean).length;
    const totalCount = STEPS.length;
    const isComplete = completedCount === totalCount;

    if (isComplete) {
      await admin
        .from("accounts")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      steps: STEPS.map((s) => ({ ...s, completed: !!merged[s.key] })),
      progress: {
        completed: completedCount,
        total: totalCount,
        percent: Math.round((completedCount / totalCount) * 100),
        isComplete,
      },
    });
  } catch (err) {
    console.error("[ONBOARDING] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

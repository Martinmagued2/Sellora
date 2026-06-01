import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";

// Service role client (lazy-initialized for use in route handlers)
import { createClient } from "@supabase/supabase-js";
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
 * POST /api/admin/broadcast
 * Send platform-wide announcement / create campaign for each eligible account
 *
 * Body:
 * {
 *   message: string,            // The broadcast message content
 *   channels: ["instagram", "facebook", "whatsapp"],  // Target channels
 *   target: "all" | "plan:starter" | "plan:professional" | "plan:business",
 *   name?: string,              // Campaign name (defaults to "Platform Announcement")
 * }
 */
export async function POST(request) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { message, channels, target, name } = body;

    // Validate required fields
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json({ error: "At least one channel is required" }, { status: 400 });
    }

    const validChannels = ["instagram", "facebook", "whatsapp"];
    const invalidChannels = channels.filter((c) => !validChannels.includes(c));
    if (invalidChannels.length > 0) {
      return NextResponse.json(
        { error: `Invalid channels: ${invalidChannels.join(", ")}. Valid: ${validChannels.join(", ")}` },
        { status: 400 }
      );
    }

    if (!target || typeof target !== "string") {
      return NextResponse.json({ error: "Target is required (e.g., 'all' or 'plan:starter')" }, { status: 400 });
    }

    const supabase = getSupabase();

    // ─── Build account filter based on target ───
    let accountQuery = supabase
      .from("accounts")
      .select("id, business_name, email, plan, instagram_connected, facebook_connected, whatsapp_connected")
      .neq("plan_status", "canceled"); // Exclude canceled accounts

    if (target.startsWith("plan:")) {
      const plan = target.replace("plan:", "");
      const validPlans = ["starter", "professional", "business"];
      if (!validPlans.includes(plan)) {
        return NextResponse.json(
          { error: `Invalid plan. Valid: ${validPlans.join(", ")}` },
          { status: 400 }
        );
      }
      accountQuery = accountQuery.eq("plan", plan);
    }
    // "all" means no additional filter

    const { data: accounts, error: accountsError } = await accountQuery;

    if (accountsError) {
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: "No eligible accounts found" }, { status: 404 });
    }

    // ─── Filter accounts that have the requested channels connected ───
    const channelConnectionMap = {
      instagram: "instagram_connected",
      facebook: "facebook_connected",
      whatsapp: "whatsapp_connected",
    };

    const eligibleAccounts = accounts.filter((account) => {
      return channels.some((channel) => account[channelConnectionMap[channel]]);
    });

    if (eligibleAccounts.length === 0) {
      return NextResponse.json(
        { error: "No accounts have the requested channels connected" },
        { status: 404 }
      );
    }

    // ─── Create a campaign for each eligible account ───
    const campaignName = name || "Platform Announcement";
    const campaignResults = [];
    const errors = [];

    for (const account of eligibleAccounts) {
      // Determine which channels are actually connected for this account
      const connectedChannels = channels.filter((ch) => account[channelConnectionMap[ch]]);

      for (const channel of connectedChannels) {
        try {
          const { data: campaign, error: campaignError } = await supabase
            .from("campaigns")
            .insert({
              account_id: account.id,
              name: campaignName,
              message_template: message,
              channel: channel,
              status: "draft",
              broadcast_type: "transactional",
              audience_filter: { source: "admin_broadcast", target, channel },
            })
            .select("id, name, status, channel")
            .single();

          if (campaignError) {
            errors.push({
              account_id: account.id,
              business_name: account.business_name,
              channel,
              error: campaignError.message,
            });
          } else {
            campaignResults.push({
              campaign_id: campaign.id,
              account_id: account.id,
              business_name: account.business_name,
              channel,
              status: campaign.status,
            });
          }
        } catch (err) {
          errors.push({
            account_id: account.id,
            business_name: account.business_name,
            channel,
            error: err.message || "Unknown error",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "Broadcast campaigns created successfully",
        totalAccounts: accounts.length,
        eligibleAccounts: eligibleAccounts.length,
        campaignsCreated: campaignResults.length,
        errors: errors.length,
        campaigns: campaignResults,
        errorDetails: errors.length > 0 ? errors : undefined,
        channels,
        target,
      },
    });
  } catch (error) {
    console.error("Admin broadcast error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

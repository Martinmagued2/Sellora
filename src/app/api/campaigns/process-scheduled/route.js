import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";

// Service role client (lazy-initialized)
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
 * POST /api/campaigns/process-scheduled
 * Cron-ready endpoint that processes all scheduled campaigns whose scheduled_at has passed.
 * Can be called by a cron job (e.g., Vercel Cron, GitHub Actions, etc.)
 *
 * Authentication: Requires either:
 *   1. x-cron-secret header matching CRON_SECRET env var, OR
 *   2. Admin authentication via verifyAdmin
 */
export async function POST(req) {
  try {
    // ── Authentication: cron secret or admin ──
    const cronSecret = req.headers.get("x-cron-secret");
    const hasCronSecret = cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

    let isAuthenticated = false;

    if (hasCronSecret) {
      isAuthenticated = true;
    } else {
      // Fallback to admin auth when CRON_SECRET is not set or doesn't match
      const adminCheck = await verifyAdmin(req);
      if (adminCheck.isAdmin) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Find all scheduled campaigns where scheduled_at <= now
    const now = new Date().toISOString();
    const { data: scheduledCampaigns, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, account_id")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (fetchError) {
      console.error("Failed to fetch scheduled campaigns:", fetchError);
      return NextResponse.json({ error: "Failed to fetch scheduled campaigns" }, { status: 500 });
    }

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "No scheduled campaigns to process" });
    }

    // Trigger each campaign's send
    let processedCount = 0;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    for (const campaign of scheduledCampaigns) {
      try {
        const sendRes = await fetch(`${baseUrl}/api/campaigns/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Use x-internal-key header instead of Authorization Bearer
            "x-internal-key": process.env.SUPABASE_SERVICE_ROLE_KEY || "",
          },
          body: JSON.stringify({ campaignId: campaign.id }),
        });

        if (sendRes.ok) {
          processedCount++;
        } else {
          console.error(`Failed to send campaign ${campaign.id}:`, await sendRes.text());
        }
      } catch (err) {
        console.error(`Error processing campaign ${campaign.id}:`, err.message);
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: scheduledCampaigns.length,
    });
  } catch (error) {
    console.error("Process scheduled campaigns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

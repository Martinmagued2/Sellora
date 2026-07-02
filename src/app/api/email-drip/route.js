/**
 * Email Drip Campaign Cron
 * POST /api/email-drip
 *
 * Sends the "first week" email series to new signups:
 *   Day 1: Welcome + how to connect WhatsApp
 *   Day 3: Add your first product
 *   Day 5: Did you know? AI can create orders
 *   Day 7: How's it going? Reply with questions
 *
 * Called daily by cron-job.org. Protected by CRON_SECRET (REQUIRED).
 * Uses the new branded sendDripEmail() helper for consistent identity.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDripEmail, isEmailConfigured } from "@/lib/email";

let _supabase = null;
function getSupabase() {
  if (!_supabase)
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _supabase;
}

const DRIP_STEPS = [
  {
    day: 1,
    subject: "Welcome to Sellora! Here's how to get started",
    bodyHtml: `
      <p>You're just 3 steps away from automating your WhatsApp sales:</p>
      <ol>
        <li><strong>Connect WhatsApp</strong> — Go to Settings → Channels → Connect WhatsApp</li>
        <li><strong>Add a product</strong> — Go to Products → Add your first item</li>
        <li><strong>Test the AI</strong> — Send a message to your WhatsApp number</li>
      </ol>
      <p>That's it! The AI will start replying to customers automatically.</p>
      <p><a href="https://sellorachat.com/dashboard" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6C5CE7,#a855f7);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Go to Dashboard →</a></p>
    `,
  },
  {
    day: 3,
    subject: "Have you added your products yet?",
    bodyHtml: `
      <p>Your AI needs products to sell!</p>
      <p>Adding products takes 30 seconds and lets your AI agent recommend items, check stock, and create orders automatically.</p>
      <div class="info-box">
        <div class="info-label">Quick Tip</div>
        <div class="info-text">Add a description for each product — the AI uses it to answer customer questions naturally.</div>
      </div>
      <p><a href="https://sellorachat.com/dashboard/products" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6C5CE7,#a855f7);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Add Products Now →</a></p>
    `,
  },
  {
    day: 5,
    subject: "Did you know? Your AI can create orders",
    bodyHtml: `
      <p>Your Sellora AI can do more than just reply to messages:</p>
      <ul style="line-height:2;color:#374151;font-size:15px;">
        <li>✅ Build multi-item carts</li>
        <li>✅ Apply coupon codes automatically</li>
        <li>✅ Create orders mid-conversation</li>
        <li>✅ Send payment links</li>
        <li>✅ Remember customer preferences</li>
      </ul>
      <p>This means customers can go from <em>"How much?"</em> to <em>"Order placed"</em> without you lifting a finger.</p>
      <p><a href="https://sellorachat.com/dashboard/conversations" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6C5CE7,#a855f7);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Try the AI Copilot →</a></p>
    `,
  },
  {
    day: 7,
    subject: "How's it going? We're here to help",
    bodyHtml: `
      <p>It's been a week since you joined Sellora. How's it going?</p>
      <p>If you have any questions — about WhatsApp setup, AI personality, products, or anything else — just reply to this email. We're here to help you succeed.</p>
      <div class="info-box">
        <div class="info-label">Pro Tip</div>
        <div class="info-text">Customize your AI's personality in Settings → AI Personality to match your brand's tone.</div>
      </div>
      <p><a href="https://sellorachat.com/dashboard/settings" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6C5CE7,#a855f7);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Customize Your AI →</a></p>
    `,
  },
];

export async function POST(req) {
  // Pattern B: CRON_SECRET is REQUIRED (not optional)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      success: false,
      error: "RESEND_API_KEY not configured — drip emails cannot be sent",
    });
  }

  const supabase = getSupabase();
  const stats = { sent: 0, errors: 0, skipped: 0 };

  for (const step of DRIP_STEPS) {
    const since = new Date(Date.now() - step.day * 86400_000).toISOString();
    const before = new Date(Date.now() - (step.day - 1) * 86400_000).toISOString();

    // Find accounts created exactly N days ago
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, email, business_name, email_drip_opt_out")
      .gte("created_at", since)
      .lt("created_at", before);

    for (const account of accounts || []) {
      // Respect opt-out (BUG #10)
      if (account.email_drip_opt_out) {
        stats.skipped++;
        continue;
      }

      // Check if already sent (dedup)
      const { data: existing } = await supabase
        .from("email_drip_logs")
        .select("id")
        .eq("account_id", account.id)
        .eq("drip_type", "first_week")
        .eq("step_number", step.day)
        .maybeSingle();

      if (existing) {
        stats.skipped++;
        continue;
      }

      try {
        const result = await sendDripEmail({
          to: account.email,
          step: step.day,
          subject: step.subject,
          bodyHtml: step.bodyHtml,
          accountId: account.id,
          businessName: account.business_name,
        });

        if (result.success) {
          await supabase.from("email_drip_logs").insert({
            account_id: account.id,
            email: account.email,
            drip_type: "first_week",
            step_number: step.day,
          });
          stats.sent++;
        } else {
          console.error(`[DRIP] failed for ${account.email} step ${step.day}:`, result.error);
          stats.errors++;
        }
      } catch (e) {
        console.error(`[DRIP] exception for ${account.email} step ${step.day}:`, e.message);
        stats.errors++;
      }
    }
  }

  return NextResponse.json({ success: true, stats, at: new Date().toISOString() });
}

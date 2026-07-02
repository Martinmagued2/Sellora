/**
 * GET /api/email/unsubscribe?token=...
 *
 * One-click unsubscribe (List-Unsubscribe-Post: One-Click).
 * Marks the recipient as unsubscribed in email_unsubscribes.
 * Renders a simple HTML confirmation page.
 *
 * POST requests (from Resend's one-click webhook) are also accepted.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _admin = null;
function getAdmin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

const CONFIRMATION_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed — Sellora</title>
  <style>
    body { margin:0; padding:0; background:#0f0a1f; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:#fff; max-width:480px; width:90%; padding:48px 40px; border-radius:16px; text-align:center; }
    .icon { width:64px; height:64px; border-radius:50%; background:rgba(108,92,231,0.1); margin:0 auto 20px; display:flex; align-items:center; justify-content:center; font-size:32px; }
    h1 { font-size:24px; font-weight:800; color:#0f0a1f; margin:0 0 12px; }
    p { color:#6b7280; font-size:15px; line-height:1.6; margin:0 0 24px; }
    a { display:inline-block; padding:12px 24px; background:#6C5CE7; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>You're unsubscribed</h1>
    <p>You will no longer receive these emails from Sellora. This may take up to 24 hours to take full effect.</p>
    <a href="https://sellorachat.com">Visit Sellora</a>
  </div>
</body>
</html>
`;

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) {
    return new NextResponse("Service unavailable", { status: 503 });
  }

  // Update the unsubscribe row to mark it confirmed
  const { data, error } = await admin
    .from("email_unsubscribes")
    .update({ reason: "user_clicked", created_at: new Date().toISOString() })
    .eq("token", token)
    .select("email, template_type")
    .maybeSingle();

  if (error) {
    console.error("[UNSUBSCRIBE] error:", error.message);
  }

  // Even if not found (already unsubscribed or invalid token), show confirmation
  return new NextResponse(CONFIRMATION_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req) {
  // One-click unsubscribe (RFC 8058) — Resend sends a POST with the email
  // in the body. We extract it and mark as unsubscribed.
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email || body.recipient || body.To;
    const eventType = body.type || body.event;

    if (!email) {
      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    const admin = getAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    // If this is a Resend webhook (event: "email.unsubscribed" or "email.complained"),
    // insert/update the unsubscribes table
    const isComplaint = eventType === "email.complained";
    await admin.from("email_unsubscribes").upsert(
      {
        email,
        template_type: "all",
        reason: isComplaint ? "complaint" : "one_click",
        token: `resend_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      },
      { onConflict: "email,account_id,template_type" }
    );

    return NextResponse.json({ success: true, email });
  } catch (e) {
    console.error("[UNSUBSCRIBE POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

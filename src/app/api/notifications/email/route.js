/**
 * Email Notification Endpoint
 * POST /api/notifications/email
 *
 * Sends an email notification to the business owner when the AI escalates.
 * Uses the centralized Resend email service at @/lib/email.
 *
 * SECURITY: Requires authentication + the recipient (to) is looked up from
 * the account, NOT taken from the request body. Previously this endpoint was
 * unauthenticated and accepted an arbitrary `to` field — making Sellora an
 * open email relay that anyone could use as a phishing launcher.
 */

import { sendEscalationEmail, isEmailConfigured } from "@/lib/email";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";
import { createClient } from "@supabase/supabase-js";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

export async function POST(req) {
  try {
    // SECURITY: Require authentication.
    const user = await getAuthUser(req);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { accountId, type, customerName, channel, reason, conversationId } = body;

    if (!accountId) {
      return Response.json({ error: "Missing required field: accountId" }, { status: 400 });
    }

    // SECURITY: Verify the user can access this account (owner or team member).
    const hasAccess = await canAccessAccount(user, accountId);
    if (!hasAccess) {
      return Response.json({ error: "You do not have access to this account" }, { status: 403 });
    }

    // SECURITY: Look up the recipient email from the account itself.
    // Do NOT accept `to` from the request body — that would allow any authenticated
    // user to send emails to arbitrary addresses (open relay / phishing).
    const { data: account } = await admin()
      .from("accounts")
      .select("email, owner_name, business_name")
      .eq("id", accountId)
      .maybeSingle();

    if (!account || !account.email) {
      return Response.json({ error: "Account email not found" }, { status: 404 });
    }

    const to = account.email;

    if (!isEmailConfigured()) {
      console.log(`[EMAIL] No RESEND_API_KEY configured. Would send escalation email to ${to}:`);
      console.log(`[EMAIL] Subject: AI Escalation Alert — ${customerName} needs your help`);
      console.log(`[EMAIL] Body: ${customerName} on ${channel} needs human attention: ${reason}`);
      return Response.json({
        status: "logged_only",
        message: "Email not sent — RESEND_API_KEY not configured. Notification stored in-app.",
      });
    }

    const result = await sendEscalationEmail({
      to,
      customerName,
      channel,
      reason,
      conversationId,
    });

    if (!result.success) {
      return Response.json({ status: "email_failed", error: result.error }, { status: 500 });
    }

    console.log(`[EMAIL] Escalation email sent to ${to}`);
    return Response.json({ status: "sent", messageId: result.messageId });
  } catch (err) {
    console.error("[EMAIL] Error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

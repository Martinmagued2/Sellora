/**
 * Email Notification Endpoint
 * POST /api/notifications/email
 *
 * Sends an email notification to the business owner when the AI escalates.
 * Now uses the centralized Resend email service at @/lib/email.
 */

import { sendEscalationEmail, isEmailConfigured } from "@/lib/email";

export async function POST(req) {
  try {
    const body = await req.json();
    const { accountId, type, to, customerName, channel, reason, conversationId } = body;

    if (!accountId || !to) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

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

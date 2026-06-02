/**
 * Email Test Endpoint
 * POST /api/email/test
 *
 * Sends a test email to verify Resend configuration.
 * Requires admin auth.
 */

import { sendCustomEmail, isEmailConfigured } from "@/lib/email";
import { verifyAdmin } from "@/lib/admin-auth";

export async function POST(req) {
  try {
    // Auth: accept x-admin-key header OR adminKey in body
    const { isAdmin } = await verifyAdmin(req);
    const body = await req.json();
    const bodyKey = body.adminKey;

    if (!isAdmin && bodyKey !== process.env.ADMIN_SECRET_KEY) {
      return Response.json({ error: "Forbidden — admin access required. Pass adminKey in body or x-admin-key header." }, { status: 403 });
    }

    const { to, subject, html } = body;

    if (!to) {
      return Response.json({ error: "Recipient email 'to' is required" }, { status: 400 });
    }

    if (!isEmailConfigured()) {
      return Response.json({
        configured: false,
        message: "RESEND_API_KEY is not set. Add it to your environment variables.",
      });
    }

    const result = await sendCustomEmail({
      to,
      subject: subject || "Sellora Email Test",
      html: html || `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#6C5CE7;">Email Test Successful!</h2>
          <p>If you're seeing this, your Resend integration is working correctly.</p>
          <p style="color:#6b7280;font-size:13px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    return Response.json({
      configured: true,
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (err) {
    console.error("[EMAIL-TEST] Error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

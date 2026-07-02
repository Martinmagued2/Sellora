/**
 * Email Test Endpoint
 * POST /api/email/test
 *
 * Sends a test email to verify Resend configuration.
 * Requires admin auth OR logged-in Sellora user (for testing their own setup).
 *
 * Body: { to?, subject?, html?, adminKey? }
 * Returns: { configured, success, messageId?, error?, health? }
 */

import { sendCustomEmail, isEmailConfigured, isEmailFromConfigured, getEmailHealth } from "@/lib/email";
import { verifyAdmin } from "@/lib/admin-auth";
import crypto from "crypto";

function timingSafeKeyCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req) {
  try {
    const { isAdmin } = await verifyAdmin(req);
    const body = await req.json();
    const bodyKey = body.adminKey;

    if (bodyKey) {
      if (!timingSafeKeyCompare(bodyKey, process.env.ADMIN_SECRET_KEY || "")) {
        return Response.json({ error: "Invalid admin key" }, { status: 403 });
      }
    } else if (!isAdmin) {
      const { createServerClient } = await import("@supabase/ssr");
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return Response.json({ error: "Authentication required" }, { status: 401 });
      }
    }

    const { to, subject, html } = body;

    if (!isEmailConfigured()) {
      return Response.json({
        configured: false,
        health: getEmailHealth(),
        message: "RESEND_API_KEY is not set. Add it to your Vercel environment variables.",
      });
    }

    if (!isEmailFromConfigured()) {
      return Response.json({
        configured: true,
        health: getEmailHealth(),
        warning: "RESEND_FROM_EMAIL is using Resend's sandbox address (onboarding@resend.dev). Emails will ONLY deliver to the Resend account owner. Set RESEND_FROM_EMAIL to a verified domain address (e.g. support@sellorachat.com).",
      });
    }

    if (!to) {
      return Response.json({
        configured: true,
        health: getEmailHealth(),
        error: "Recipient email 'to' is required",
      }, { status: 400 });
    }

    const testHtml = html || `
      <h1>Email Test Successful! ✅</h1>
      <p>If you're seeing this, your Sellora email integration is working correctly.</p>
      <div class="info-box">
        <div class="info-label">Test Details</div>
        <div class="info-text">
          <strong>Sent at:</strong> ${new Date().toISOString()}<br>
          <strong>From:</strong> ${process.env.RESEND_FROM_EMAIL}<br>
          <strong>To:</strong> ${to}
        </div>
      </div>
      <p style="font-size:13px;color:#6b7280;">You can now receive signup confirmations, password resets, order notifications, weekly summaries, and more.</p>
    `;

    const result = await sendCustomEmail({
      to,
      subject: subject || "[Sellora] Email Test",
      html: testHtml,
      templateName: "test",
    });

    return Response.json({
      configured: true,
      health: getEmailHealth(),
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (err) {
    console.error("[EMAIL-TEST] Error:", err.message);
    return Response.json({ error: "Internal server error", detail: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  // Health check — no auth required, just reports configuration status
  return Response.json({
    configured: isEmailConfigured(),
    fromConfigured: isEmailFromConfigured(),
    health: getEmailHealth(),
  });
}

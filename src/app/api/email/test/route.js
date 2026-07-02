/**
 * Email Test Endpoint
 * POST /api/email/test
 *
 * Sends a test email to verify Resend configuration.
 * Requires admin auth.
 */

import { sendCustomEmail, isEmailConfigured } from "@/lib/email";
import { verifyAdmin } from "@/lib/admin-auth";
import crypto from "crypto";

// 🔒 SECURITY: Timing-safe admin key comparison
function timingSafeKeyCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // Constant-time dummy
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req) {
  try {
    // Auth: accept any logged-in user (for testing), OR admin key
    const { isAdmin } = await verifyAdmin(req);
    const body = await req.json();
    const bodyKey = body.adminKey;

    // If admin key provided, check it
    if (bodyKey) {
      if (!timingSafeKeyCompare(bodyKey, process.env.ADMIN_SECRET_KEY || "")) {
        return Response.json({ error: "Invalid admin key" }, { status: 403 });
      }
    } else if (!isAdmin) {
      // Not admin — check if user is authenticated via cookie
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

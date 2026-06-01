/**
 * Email Notification Endpoint
 * POST /api/notifications/email
 * 
 * Sends an email notification to the business owner when the AI escalates.
 * Uses Resend (or falls back to a simple log if not configured).
 */

import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { accountId, type, to, customerName, channel, reason, conversationId } = body;

    if (!accountId || !to) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if RESEND_API_KEY is configured
    if (!process.env.RESEND_API_KEY) {
      console.log(`[EMAIL] No RESEND_API_KEY configured. Would send escalation email to ${to}:`);
      console.log(`[EMAIL] Subject: AI Escalation Alert — ${customerName} needs your help`);
      console.log(`[EMAIL] Body: ${customerName} on ${channel} needs human attention: ${reason}`);
      return Response.json({ 
        status: "logged_only", 
        message: "Email not sent — RESEND_API_KEY not configured. Notification stored in-app." 
      });
    }

    // Send email via Resend
    const channelLabel = channel === "facebook" ? "Facebook" : channel === "instagram" ? "Instagram" : channel === "whatsapp" ? "WhatsApp" : channel;
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sellora AI <noreply@sellora.app>",
        to: [to],
        subject: `🚨 AI Escalation Alert — ${customerName} needs your help`,
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #FF6B6B, #EE5A24); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 20px;">🤖 AI Needs Your Help</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
                Your AI assistant couldn't fully handle a customer conversation and is requesting human intervention.
              </p>
            </div>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <table style="width: 100%; font-size: 14px;">
                <tr><td style="padding: 4px 0; color: #666; width: 120px;">Customer:</td><td style="font-weight: 600;">${customerName}</td></tr>
                <tr><td style="padding: 4px 0; color: #666;">Channel:</td><td>${channelLabel}</td></tr>
                <tr><td style="padding: 4px 0; color: #666;">Reason:</td><td style="color: #e74c3c; font-weight: 600;">${reason}</td></tr>
              </table>
            </div>
            
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}`}/dashboard/conversations" 
               style="display: inline-block; background: #6C5CE7; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              View Conversation
            </a>
            
            <p style="color: #999; font-size: 12px; margin-top: 24px;">
              The AI has already responded to the customer and let them know a team member will follow up.
              You're receiving this because AI escalation notifications are enabled for your account.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("[EMAIL] Resend API error:", errorData);
      return Response.json({ status: "email_failed", error: errorData }, { status: 500 });
    }

    console.log(`[EMAIL] Escalation email sent to ${to}`);
    return Response.json({ status: "sent" });
  } catch (err) {
    console.error("[EMAIL] Error:", err.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

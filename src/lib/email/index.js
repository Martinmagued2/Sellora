/**
 * Sellora Centralized Email Service — Powered by Resend
 * ─────────────────────────────────────────────────────────────────
 * Rebuilt 2026-07-03 — production-grade email infrastructure.
 *
 * Features:
 *   • Branded HTML template with Sellora AI logo, gradient header, footer
 *   • Centralized email_log table (every send is persisted)
 *   • Unsubscribe token generation + List-Unsubscribe header
 *   • Robust error handling (normalizes Resend SDK error shapes)
 *   • Domain validation (fails loudly if RESEND_FROM_EMAIL is sandbox)
 *   • Dedup support (skip if same template already sent recently)
 *
 * Every public function returns { success, messageId?, error? }.
 */

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════
//  HTML sanitization — prevents XSS in email templates
// ═══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  if (typeof str !== "string") return String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ═══════════════════════════════════════════════════════════════
//  Resend client singleton (lazy-initialised)
// ═══════════════════════════════════════════════════════════════
let _resend = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) return null;
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// ═══════════════════════════════════════════════════════════════
//  Supabase admin client for email_log + email_unsubscribes writes
// ═══════════════════════════════════════════════════════════════
let _admin = null;
function getAdmin() {
  if (!_admin) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

// ═══════════════════════════════════════════════════════════════
//  Config
// ═══════════════════════════════════════════════════════════════
const rawFromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const FROM_DEFAULT = rawFromEmail.includes("<")
  ? rawFromEmail
  : `Sellora <${rawFromEmail}>`;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  `https://${process.env.VERCEL_URL || "sellorachat.com"}`;

// Warn loudly if the sandbox sender is being used in production
if (
  process.env.NODE_ENV === "production" &&
  rawFromEmail === "onboarding@resend.dev"
) {
  console.error(
    "[EMAIL] ⚠️  CRITICAL: RESEND_FROM_EMAIL is not set. Using Resend sandbox 'onboarding@resend.dev' which ONLY delivers to the Resend account owner. All other recipients will be rejected."
  );
}

// ═══════════════════════════════════════════════════════════════
//  PII masking for logs
// ═══════════════════════════════════════════════════════════════
function maskEmail(email) {
  if (!email || typeof email !== "string") return "***";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.substring(0, 2)}***@${domain}`;
}

// ═══════════════════════════════════════════════════════════════
//  Normalize Resend errors (SDK v6 returns inconsistent shapes)
// ═══════════════════════════════════════════════════════════════
function normalizeError(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  if (err.error?.message) return err.error.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Unsubscribe token generation
// ═══════════════════════════════════════════════════════════════
function generateToken() {
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}

/**
 * Check if an email has unsubscribed from a template type.
 * @param {string} email
 * @param {string} templateType  - 'all' | 'marketing' | 'drip' | 'weekly_summary' | 'notifications' | ...
 * @returns {Promise<boolean>}
 */
export async function isUnsubscribed(email, templateType = "all") {
  const admin = getAdmin();
  if (!admin) return false;
  try {
    const { data } = await admin
      .from("email_unsubscribes")
      .select("id")
      .eq("email", email)
      .or(`template_type.eq.all,template_type.eq.${templateType}`)
      .limit(1);
    return !!(data && data.length > 0);
  } catch (e) {
    console.warn("[EMAIL] unsubscribe check failed:", e.message);
    return false;
  }
}

/**
 * Persist an email_log row.
 */
async function logEmail({
  accountId,
  to,
  from,
  subject,
  templateName,
  resendId,
  status,
  error,
  metadata,
}) {
  const admin = getAdmin();
  if (!admin) return;
  try {
    await admin.from("email_log").insert({
      account_id: accountId || null,
      to_email: Array.isArray(to) ? to.join(",") : to,
      from_email: from || FROM_DEFAULT,
      subject,
      template_name: templateName,
      resend_id: resendId || null,
      status,
      error: error || null,
      metadata: metadata || {},
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[EMAIL] failed to log email:", e.message);
  }
}

/**
 * Check if a template was already sent to this recipient recently.
 * Used for dedup (e.g. welcome email, password reset).
 */
async function wasRecentlySent({ to, templateName, withinHours = 24 }) {
  const admin = getAdmin();
  if (!admin) return false;
  try {
    const cutoff = new Date(Date.now() - withinHours * 3600_000).toISOString();
    const { data } = await admin
      .from("email_log")
      .select("id")
      .eq("to_email", to)
      .eq("template_name", templateName)
      .eq("status", "sent")
      .gte("sent_at", cutoff)
      .limit(1);
    return !!(data && data.length > 0);
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  CORE SEND HELPER
// ═══════════════════════════════════════════════════════════════
/**
 * @param {Object} params
 * @param {string|string[]} params.to
 * @param {string} params.subject
 * @param {string} params.html
 * @param {string} [params.text]            - plain-text fallback (also used if html missing)
 * @param {string} [params.from]
 * @param {string} [params.replyTo]
 * @param {string} [params.templateName]    - for email_log
 * @param {string} [params.accountId]
 * @param {Object} [params.metadata]
 * @param {boolean} [params.allowUnsubscribe] - if true, skip if recipient unsubscribed
 * @param {string} [params.unsubscribeType]  - 'marketing' | 'drip' | 'weekly_summary' | 'notifications'
 * @param {Object} [params.headers]          - extra Resend headers
 */
async function send(params) {
  const {
    to,
    subject,
    html,
    text,
    from,
    replyTo,
    templateName = "custom",
    accountId,
    metadata,
    allowUnsubscribe = false,
    unsubscribeType,
    headers = {},
  } = params;

  const resend = getResend();
  if (!resend) {
    console.warn("[EMAIL] RESEND_API_KEY not configured — email skipped.");
    console.warn(`[EMAIL] Would send to ${maskEmail(to)}: ${subject}`);
    await logEmail({
      accountId,
      to,
      from,
      subject,
      templateName,
      status: "failed",
      error: "RESEND_API_KEY not configured",
      metadata,
    });
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  // Unsubscribe check
  if (allowUnsubscribe && unsubscribeType) {
    const recipients = Array.isArray(to) ? to : [to];
    for (const r of recipients) {
      if (await isUnsubscribed(r, unsubscribeType)) {
        console.log(`[EMAIL] Skipped — ${maskEmail(r)} unsubscribed from ${unsubscribeType}`);
        await logEmail({
          accountId,
          to: r,
          from,
          subject,
          templateName,
          status: "unsubscribed",
          metadata,
        });
        return { success: false, error: "Recipient unsubscribed" };
      }
    }
  }

  // Build the final HTML: if html is missing but text is provided, wrap text in <pre>
  let finalHtml = html;
  if (!finalHtml && text) {
    finalHtml = layout({
      preheader: subject,
      bodyContent: `<pre style="font-family:inherit;white-space:pre-wrap;">${escapeHtml(text)}</pre>`,
    });
  }
  if (!finalHtml) {
    return { success: false, error: "No email body provided (need html or text)" };
  }

  // Build headers — always include List-Unsubscribe for marketing emails
  const finalHeaders = { ...headers };
  if (allowUnsubscribe) {
    const unsubToken = generateToken();
    const unsubUrl = `${APP_URL}/api/email/unsubscribe?token=${unsubToken}`;
    finalHeaders["List-Unsubscribe"] = `<${unsubUrl}>`;
    finalHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";

    // Persist the token for one-click unsubscribe verification
    const admin = getAdmin();
    if (admin) {
      const recipients = Array.isArray(to) ? to : [to];
      for (const r of recipients) {
        admin
          .from("email_unsubscribes")
          .insert({
            email: r,
            account_id: accountId || null,
            template_type: unsubscribeType || "all",
            token: unsubToken,
            reason: "pending", // will be set to "user_clicked" when they click
          })
          .then(({ error }) => {
            if (error && !error.message.includes("duplicate")) {
              console.warn("[EMAIL] failed to seed unsubscribe token:", error.message);
            }
          })
          .catch(() => {});
      }
    }
  }

  try {
    const payload = {
      from: from || FROM_DEFAULT,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: finalHtml,
      ...(text && { text }),
      ...(replyTo && { reply_to: replyTo }),
      ...(Object.keys(finalHeaders).length > 0 && { headers: finalHeaders }),
    };

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      const errMsg = normalizeError(error);
      console.error("[EMAIL] Resend error:", errMsg);
      await logEmail({
        accountId,
        to,
        from,
        subject,
        templateName,
        status: "failed",
        error: errMsg,
        metadata,
      });
      return { success: false, error: errMsg };
    }

    console.log(`[EMAIL] Sent to ${maskEmail(to)} — id=${data?.id} — ${templateName}`);
    await logEmail({
      accountId,
      to,
      from,
      subject,
      templateName,
      resendId: data?.id,
      status: "sent",
      metadata,
    });
    return { success: true, messageId: data?.id };
  } catch (err) {
    const errMsg = normalizeError(err);
    console.error("[EMAIL] Exception:", errMsg);
    await logEmail({
      accountId,
      to,
      from,
      subject,
      templateName,
      status: "failed",
      error: errMsg,
      metadata,
    });
    return { success: false, error: errMsg };
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHARED LAYOUT WRAPPER — Sellora branded
// ═══════════════════════════════════════════════════════════════
function layout({ preheader, bodyContent, footerNote }) {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(preheader)}</title>
  <!--[if mso]>
  <style>
    table { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body { margin:0; padding:0; background:#0f0a1f; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; -webkit-font-smoothing:antialiased; }
    .preheader { display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; }
    .wrapper { max-width:600px; margin:0 auto; background:#ffffff; border-radius:0; overflow:hidden; }
    .header { background:linear-gradient(135deg,#6C5CE7 0%,#8B5CF6 50%,#a855f7 100%); padding:36px 40px; position:relative; }
    .header::after { content:""; position:absolute; bottom:0; left:0; right:0; height:4px; background:linear-gradient(90deg,#a855f7,#ec4899,#a855f7); }
    .logo { display:flex; align-items:center; gap:12px; }
    .logo-mark { width:44px; height:44px; border-radius:12px; background:rgba(255,255,255,0.18); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; font-weight:900; font-size:22px; color:#fff; letter-spacing:-1px; border:1px solid rgba(255,255,255,0.25); }
    .logo-text { color:#fff; font-size:22px; font-weight:800; letter-spacing:-0.5px; line-height:1; }
    .logo-text .ai { color:rgba(255,255,255,0.7); font-weight:600; font-size:14px; margin-left:6px; letter-spacing:1px; }
    .tagline { color:rgba(255,255,255,0.85); margin:14px 0 0; font-size:13px; font-weight:500; letter-spacing:0.2px; }
    .body { padding:36px 40px 8px; }
    .body h1, .body h2, .body h3 { color:#0f0a1f; font-weight:800; letter-spacing:-0.4px; margin:0 0 14px; }
    .body h1 { font-size:24px; }
    .body h2 { font-size:20px; }
    .body h3 { font-size:16px; }
    .body p { color:#374151; font-size:15px; line-height:1.7; margin:0 0 16px; }
    .body a { color:#6C5CE7; }
    .body strong { color:#0f0a1f; }
    .body table.data { width:100%; border-collapse:collapse; font-size:14px; margin:8px 0 16px; }
    .body table.data td { padding:10px 0; border-bottom:1px solid #f3f4f6; }
    .body table.data .label { color:#6b7280; width:140px; vertical-align:top; font-weight:500; }
    .body table.data .value { color:#111827; font-weight:600; }
    .btn { display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#6C5CE7,#a855f7); color:#ffffff!important; text-decoration:none; border-radius:10px; font-weight:700; font-size:15px; margin:8px 0; box-shadow:0 4px 14px rgba(108,92,231,0.3); }
    .btn:hover { background:linear-gradient(135deg,#5a4bd1,#9333ea); }
    .btn-secondary { display:inline-block; padding:10px 20px; background:#f3f0ff; color:#6C5CE7!important; text-decoration:none; border-radius:8px; font-weight:600; font-size:13px; margin:8px 0; }
    .alert-box { background:#FEF2F2; border-left:4px solid #DC2626; border-radius:8px; padding:16px 20px; margin:16px 0; }
    .alert-box .alert-label { color:#DC2626; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px; }
    .alert-box .alert-text { color:#991B1B; font-size:14px; line-height:1.5; }
    .info-box { background:linear-gradient(135deg,#F3F0FF,#FAF5FF); border-left:4px solid #6C5CE7; border-radius:8px; padding:16px 20px; margin:16px 0; }
    .info-box .info-label { color:#6C5CE7; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px; }
    .info-box .info-text { color:#4C1D95; font-size:14px; line-height:1.6; }
    .success-box { background:linear-gradient(135deg,#ECFDF5,#F0FDF4); border-left:4px solid #059669; border-radius:8px; padding:16px 20px; margin:16px 0; }
    .success-box .success-label { color:#059669; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px; }
    .success-box .success-text { color:#065F46; font-size:14px; line-height:1.6; }
    .stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:16px 0; }
    .stat-card { background:#FAFAFB; border:1px solid #f3f4f6; border-radius:10px; padding:16px; text-align:center; }
    .stat-card .stat-value { font-size:22px; font-weight:800; color:#0f0a1f; line-height:1; }
    .stat-card .stat-label { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-top:6px; font-weight:600; }
    .items-table { width:100%; border-collapse:collapse; font-size:14px; margin:12px 0; }
    .items-table th { text-align:left; padding:10px 12px; background:#FAFAFB; color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; border-bottom:2px solid #e5e7eb; }
    .items-table th.right { text-align:right; }
    .items-table th.center { text-align:center; }
    .items-table td { padding:12px; border-bottom:1px solid #f3f4f6; color:#111827; }
    .items-table td.right { text-align:right; font-weight:600; }
    .items-table td.center { text-align:center; }
    .items-table tfoot td { padding:14px 12px; font-weight:800; border-top:2px solid #e5e7eb; color:#0f0a1f; }
    .items-table tfoot td.total-value { color:#6C5CE7; font-size:17px; }
    .footer { background:#0f0a1f; padding:32px 40px; }
    .footer .footer-brand { color:#fff; font-weight:800; font-size:16px; margin-bottom:8px; }
    .footer .footer-brand .ai { color:#a855f7; font-weight:600; font-size:12px; margin-left:4px; }
    .footer p { color:rgba(255,255,255,0.6); font-size:12px; line-height:1.6; margin:0 0 8px; }
    .footer a { color:#a855f7; text-decoration:none; }
    .footer .footer-links { margin:12px 0; }
    .footer .footer-links a { color:rgba(255,255,255,0.8); font-size:12px; margin-right:16px; }
    .divider { height:1px; background:#f3f4f6; margin:24px 0; }
    @media only screen and (max-width: 480px) {
      .header, .body, .footer { padding:24px 20px; }
      .stat-grid { grid-template-columns:1fr; }
      .btn { display:block; text-align:center; }
    }
  </style>
</head>
<body>
  <div class="preheader">${escapeHtml(preheader)}</div>
  <div class="wrapper">
    <div class="header">
      <div class="logo">
        <div class="logo-mark">S</div>
        <div class="logo-text">Sellora<span class="ai">AI</span></div>
      </div>
      <p class="tagline">Smart commerce, on autopilot</p>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      <div class="footer-brand">Sellora<span class="ai">AI</span></div>
      <p>AI-powered conversational commerce for modern brands.</p>
      ${footerNote ? `<p>${footerNote}</p>` : ""}
      <div class="footer-links">
        <a href="${APP_URL}">Dashboard</a>
        <a href="${APP_URL}/dashboard/settings">Settings</a>
        <a href="mailto:support@sellorachat.com">Support</a>
      </div>
      <p>&copy; ${year} Sellora Inc. All rights reserved.</p>
      <p>You received this email because you have an account on <a href="${APP_URL}">sellorachat.com</a>.</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
//  EMAIL TEMPLATES — all use the branded layout()
// ═══════════════════════════════════════════════════════════════

/**
 * 1. AI Escalation Alert — sent when the AI can't handle a conversation
 */
export async function sendEscalationEmail({
  to,
  customerName,
  channel,
  reason,
  conversationId,
  accountId,
}) {
  const channelLabel =
    { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", telegram: "Telegram", email: "Email" }[
      channel
    ] || channel;
  const convoLink = `${APP_URL}/dashboard/conversations`;

  const html = layout({
    preheader: `AI needs your help — ${customerName} on ${channelLabel}`,
    bodyContent: `
      <h1>AI needs your help 🤖</h1>
      <p>Your Sellora AI assistant couldn't fully handle a customer conversation and is requesting human intervention.</p>
      <div class="alert-box">
        <div class="alert-label">Escalation Required</div>
        <div class="alert-text">${escapeHtml(reason)}</div>
      </div>
      <table class="data">
        <tr><td class="label">Customer</td><td class="value">${escapeHtml(customerName) || "Unknown"}</td></tr>
        <tr><td class="label">Channel</td><td class="value">${escapeHtml(channelLabel)}</td></tr>
        <tr><td class="label">Conversation</td><td class="value">#${escapeHtml(conversationId?.slice(0, 8)) || "N/A"}</td></tr>
      </table>
      <p style="margin-top:20px;">
        <a href="${convoLink}" class="btn">View Conversation</a>
      </p>
      <p style="font-size:13px;color:#6b7280;margin-top:12px;">The AI has already responded to the customer and let them know a team member will follow up shortly.</p>
    `,
  });

  return send({
    to,
    subject: `[Sellora] AI Escalation — ${customerName} on ${channelLabel}`,
    html,
    templateName: "escalation",
    accountId,
    metadata: { customerName, channel, conversationId },
  });
}

/**
 * 2. Team Invite — sent when an owner invites a new team member
 */
export async function sendTeamInviteEmail({ to, businessName, inviteLink, accountId }) {
  const html = layout({
    preheader: `You've been invited to join ${businessName || "a team"} on Sellora`,
    bodyContent: `
      <h1>You're invited! 👋</h1>
      <p>You have been invited to join <strong>${escapeHtml(businessName) || "a team"}</strong> on Sellora to help manage customer conversations and grow the business.</p>
      <div class="info-box">
        <div class="info-label">What you'll get</div>
        <div class="info-text">Access to the team dashboard, AI-powered conversation tools, customer CRM, and real-time analytics — all in one place.</div>
      </div>
      <p>Click the button below to accept the invitation and set up your account:</p>
      <p><a href="${inviteLink}" class="btn">Accept Invitation</a></p>
      <p style="font-size:13px;color:#6b7280;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    `,
  });

  return send({
    to,
    subject: `[Sellora] You've been invited to join ${businessName || "a team"}`,
    html,
    templateName: "team_invite",
    accountId,
    metadata: { businessName, inviteLink },
  });
}

/**
 * 3. Welcome Email — sent after signup. Dedup: skips if sent in last 24h.
 */
export async function sendWelcomeEmail({ to, fullName, businessName, accountId }) {
  // Dedup: skip if we already sent a welcome email to this address in the last 24h
  if (await wasRecentlySent({ to, templateName: "welcome", withinHours: 24 })) {
    console.log(`[EMAIL] Welcome skipped — already sent recently to ${maskEmail(to)}`);
    return { success: false, error: "Already sent recently" };
  }

  const html = layout({
    preheader: `Welcome to Sellora, ${fullName}!`,
    bodyContent: `
      <h1>Welcome to Sellora, ${escapeHtml(fullName)}! 🎉</h1>
      <p>Your store <strong>${escapeHtml(businessName) || "your business"}</strong> is all set up. Sellora is your AI-powered commerce platform — here's what you can do:</p>
      <div class="info-box">
        <div class="info-label">Quick Start (15 minutes)</div>
        <div class="info-text">
          <strong>1.</strong> Connect your WhatsApp, Instagram &amp; Facebook channels<br>
          <strong>2.</strong> Add your products and catalog<br>
          <strong>3.</strong> Enable the AI assistant to auto-reply to customers 24/7<br>
          <strong>4.</strong> Watch your sales grow on autopilot
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">5</div><div class="stat-label">Channels</div></div>
        <div class="stat-card"><div class="stat-value">24/7</div><div class="stat-label">AI Replies</div></div>
        <div class="stat-card"><div class="stat-value">14d</div><div class="stat-label">Free Trial</div></div>
      </div>
      <p><a href="${APP_URL}/dashboard" class="btn">Go to Dashboard →</a></p>
      <p style="font-size:13px;color:#6b7280;margin-top:16px;">You're on a 14-day free trial. No credit card required. Need help? Just reply to this email.</p>
    `,
  });

  return send({
    to,
    subject: `[Sellora] Welcome — let's get ${businessName || "you"} selling!`,
    html,
    templateName: "welcome",
    accountId,
    metadata: { fullName, businessName },
  });
}

/**
 * 4. Password Reset — now uses Supabase's tokenized link (passed in resetLink)
 *    The resetLink comes from supabase.auth.resetPasswordForEmail()'s redirect,
 *    which appends a `?code=...&type=recovery` token.
 */
export async function sendPasswordResetEmail({ to, resetLink, accountId }) {
  const html = layout({
    preheader: "Reset your Sellora password",
    bodyContent: `
      <h1>Reset your password</h1>
      <p>We received a request to reset the password for your Sellora account. Click the button below to set a new password:</p>
      <p><a href="${resetLink}" class="btn">Reset Password</a></p>
      <div class="alert-box">
        <div class="alert-label">Security Notice</div>
        <div class="alert-text">This link expires in 1 hour. If you didn't request this reset, you can safely ignore this email — your password will not be changed.</div>
      </div>
      <p style="font-size:13px;color:#6b7280;">For your security, Sellora will never ask for your password by email.</p>
    `,
  });

  return send({
    to,
    subject: "[Sellora] Reset your password",
    html,
    templateName: "password_reset",
    accountId,
    metadata: { resetLink },
  });
}

/**
 * 5. Order Confirmation — sent to the business owner when a new order comes in
 */
export async function sendOrderConfirmationEmail({
  to,
  orderNumber,
  customerName,
  items,
  total,
  currency = "EGP",
  accountId,
  customerEmail,
}) {
  const itemsHtml = (items || [])
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.name || "Item")}</td>
      <td class="center">${item.quantity || 1}</td>
      <td class="right">${currency} ${(Number(item.price || 0)).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const html = layout({
    preheader: `New order #${orderNumber} from ${customerName}`,
    bodyContent: `
      <h1>New order received! 💰</h1>
      <div class="success-box">
        <div class="success-label">Order Confirmed</div>
        <div class="success-text">You just received a new order from ${escapeHtml(customerName)}.</div>
      </div>
      <table class="data">
        <tr><td class="label">Order #</td><td class="value">${escapeHtml(orderNumber)}</td></tr>
        <tr><td class="label">Customer</td><td class="value">${escapeHtml(customerName)}</td></tr>
        ${customerEmail ? `<tr><td class="label">Email</td><td class="value">${escapeHtml(customerEmail)}</td></tr>` : ""}
      </table>
      <h3 style="margin-top:24px;">Order Details</h3>
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="center">Qty</th>
            <th class="right">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">Total</td>
            <td class="right total-value">${currency} ${Number(total || 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/dashboard/orders" class="btn">View Order →</a>
      </p>
    `,
  });

  return send({
    to,
    subject: `[Sellora] New order #${orderNumber} — ${currency} ${Number(total || 0).toFixed(2)}`,
    html,
    templateName: "order_confirmation",
    accountId,
    metadata: { orderNumber, customerName, customerEmail, total, currency },
  });
}

/**
 * 6. Plan Upgrade Confirmation — sent after a successful subscription change
 */
export async function sendPlanUpgradeEmail({
  to,
  planName,
  amount,
  currency = "USD",
  interval = "monthly",
  accountId,
}) {
  const features =
    planName === "Professional"
      ? "Unlimited products, 2 channels, 1000 conversations/month, priority support."
      : planName === "Business"
      ? "Unlimited everything, 3 channels, AI-powered automation, dedicated support."
      : "All Starter features are now active.";

  const html = layout({
    preheader: `You're now on the ${planName} plan!`,
    bodyContent: `
      <h1>Welcome to ${escapeHtml(planName)}! 🚀</h1>
      <div class="success-box">
        <div class="success-label">Plan Upgraded</div>
        <div class="success-text">Your account has been upgraded to the <strong>${escapeHtml(planName)}</strong> plan.</div>
      </div>
      <table class="data">
        <tr><td class="label">Plan</td><td class="value">${escapeHtml(planName)}</td></tr>
        <tr><td class="label">Billing</td><td class="value">${currency} ${amount} / ${interval === "annual" ? "year" : "month"}</td></tr>
      </table>
      <div class="info-box">
        <div class="info-label">What's New</div>
        <div class="info-text">${escapeHtml(features)}</div>
      </div>
      <p><a href="${APP_URL}/dashboard/billing" class="btn">Manage Billing →</a></p>
    `,
  });

  return send({
    to,
    subject: `[Sellora] Welcome to the ${planName} plan!`,
    html,
    templateName: "plan_upgrade",
    accountId,
    metadata: { planName, amount, currency, interval },
  });
}

/**
 * 7. Weekly Summary — sent to business owners with their week's stats
 *    Marketing email: respects unsubscribes + List-Unsubscribe header.
 */
export async function sendWeeklySummaryEmail({ to, businessName, stats, accountId }) {
  const {
    totalConversations = 0,
    aiReplies = 0,
    newCustomers = 0,
    ordersCount = 0,
    revenue = 0,
    currency = "EGP",
    avgResponseTime = "N/A",
    topProducts = [],
    recommendation = "",
  } = stats || {};

  const topProductsHtml =
    topProducts.length > 0
      ? `<h3>Top Products This Week</h3>
         <table class="items-table">
           <thead><tr><th>Product</th><th class="right">Units Sold</th></tr></thead>
           <tbody>
             ${topProducts
               .slice(0, 5)
               .map(
                 (p) =>
                   `<tr><td>${escapeHtml(p.name)}</td><td class="right">${p.units || p.count || 0}</td></tr>`
               )
               .join("")}
           </tbody>
         </table>`
      : "";

  const recommendationHtml = recommendation
    ? `<div class="info-box">
        <div class="info-label">AI Insight</div>
        <div class="info-text">${escapeHtml(recommendation)}</div>
      </div>`
    : "";

  const html = layout({
    preheader: `Your weekly summary — ${businessName}`,
    bodyContent: `
      <h1>Your week in review 📊</h1>
      <p>Here's how <strong>${escapeHtml(businessName)}</strong> performed this week:</p>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${totalConversations}</div><div class="stat-label">Conversations</div></div>
        <div class="stat-card"><div class="stat-value">${aiReplies}</div><div class="stat-label">AI Replies</div></div>
        <div class="stat-card"><div class="stat-value">${newCustomers}</div><div class="stat-label">New Customers</div></div>
        <div class="stat-card"><div class="stat-value">${ordersCount}</div><div class="stat-label">Orders</div></div>
        <div class="stat-card"><div class="stat-value">${currency} ${Number(revenue || 0).toFixed(0)}</div><div class="stat-label">Revenue</div></div>
        <div class="stat-card"><div class="stat-value">${escapeHtml(avgResponseTime)}</div><div class="stat-label">Avg Response</div></div>
      </div>
      ${topProductsHtml}
      ${recommendationHtml}
      <p style="margin-top:20px;">
        <a href="${APP_URL}/dashboard" class="btn">View Full Dashboard →</a>
      </p>
    `,
    footerNote: `<p style="color:rgba(255,255,255,0.4);font-size:11px;">Don't want these weekly summaries? <a href="${APP_URL}/dashboard/settings" style="color:rgba(255,255,255,0.6);">Manage notification preferences</a> or <a href="#" style="color:rgba(255,255,255,0.6);">unsubscribe</a>.</p>`,
  });

  return send({
    to,
    subject: `[Sellora] Weekly summary — ${totalConversations} conversations, ${currency} ${Number(revenue || 0).toFixed(0)} revenue`,
    html,
    templateName: "weekly_summary",
    accountId,
    allowUnsubscribe: true,
    unsubscribeType: "weekly_summary",
    metadata: { businessName, stats },
  });
}

/**
 * 8. Drip Campaign Email — onboarding series. Marketing: respects unsubscribes.
 */
export async function sendDripEmail({ to, step, subject, bodyHtml, accountId, businessName }) {
  const fullHtml = layout({
    preheader: subject,
    bodyContent: `
      <h1>${escapeHtml(subject)}</h1>
      ${bodyHtml}
      <div class="info-box">
        <div class="info-label">Need Help?</div>
        <div class="info-text">Reply to this email or visit our <a href="${APP_URL}/dashboard">dashboard</a> — we're here to help you succeed.</div>
      </div>
    `,
    footerNote: `<p style="color:rgba(255,255,255,0.4);font-size:11px;">You're receiving this because you recently signed up for Sellora. <a href="#" style="color:rgba(255,255,255,0.6);">Unsubscribe</a>.</p>`,
  });

  return send({
    to,
    subject: `[Sellora] ${subject}`,
    html: fullHtml,
    templateName: `drip_step_${step}`,
    accountId,
    allowUnsubscribe: true,
    unsubscribeType: "drip",
    metadata: { step, businessName },
  });
}

/**
 * 9. Custom / Generic Email — for anything else
 *    Accepts BOTH `html` and `text` (text becomes the plain-text fallback).
 */
export async function sendCustomEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  accountId,
  templateName = "custom",
  allowUnsubscribe = false,
  unsubscribeType,
  metadata,
}) {
  return send({
    to,
    subject,
    html,
    text,
    from,
    replyTo,
    templateName,
    accountId,
    allowUnsubscribe,
    unsubscribeType,
    metadata,
  });
}

/**
 * 10. Notification Email — fired by the unified notify() system
 *     for any category the user has opted into email delivery.
 */
export async function sendNotificationEmail({
  to,
  title,
  body,
  category,
  accountId,
  ctaLink,
  ctaLabel,
}) {
  const categoryLabel =
    {
      orders: "Orders",
      payments: "Payments",
      messages: "Messages",
      customers: "Customers",
      ai: "AI Assistant",
      team: "Team",
      channels: "Channels",
      automation: "Automation",
      security: "Security",
      system: "System",
      reviews: "Reviews",
      inventory: "Inventory",
    }[category] || "Notifications";

  const ctaHtml =
    ctaLink && ctaLabel
      ? `<p style="margin-top:20px;"><a href="${ctaLink}" class="btn">${escapeHtml(ctaLabel)}</a></p>`
      : "";

  const html = layout({
    preheader: `${categoryLabel}: ${title}`,
    bodyContent: `
      <h1>${escapeHtml(categoryLabel)}</h1>
      <p style="font-size:17px;font-weight:600;color:#0f0a1f;">${escapeHtml(title)}</p>
      <div class="info-box">
        <div class="info-text">${escapeHtml(body)}</div>
      </div>
      ${ctaHtml}
    `,
    footerNote: `<p style="color:rgba(255,255,255,0.4);font-size:11px;">Don't want these notifications? <a href="${APP_URL}/dashboard/settings" style="color:rgba(255,255,255,0.6);">Manage notification preferences</a>.</p>`,
  });

  return send({
    to,
    subject: `[Sellora] ${categoryLabel}: ${title}`,
    html,
    templateName: "notification",
    accountId,
    allowUnsubscribe: true,
    unsubscribeType: "notifications",
    metadata: { category, title },
  });
}

/**
 * 11. Birthday Reward Email — sent by lifecycle automation
 */
export async function sendBirthdayEmail({ to, customerName, rewardCode, discountPercent, accountId }) {
  const html = layout({
    preheader: `Happy Birthday, ${customerName}! 🎂`,
    bodyContent: `
      <h1>Happy Birthday, ${escapeHtml(customerName)}! 🎂</h1>
      <p>From all of us at Sellora — wishing you a wonderful day! To celebrate, we'd like to gift you a special birthday reward:</p>
      <div class="success-box">
        <div class="success-label">Your Birthday Gift</div>
        <div class="success-text"><strong>${discountPercent}% off</strong> your next order.</div>
      </div>
      <p>Use the code below at checkout:</p>
      <div style="text-align:center;margin:24px 0;">
        <div style="display:inline-block;background:linear-gradient(135deg,#6C5CE7,#a855f7);color:#fff;padding:16px 36px;border-radius:10px;font-size:24px;font-weight:800;letter-spacing:2px;">${escapeHtml(rewardCode)}</div>
      </div>
      <p style="font-size:13px;color:#6b7280;text-align:center;">Valid for 7 days. One-time use only.</p>
    `,
    footerNote: `<p style="color:rgba(255,255,255,0.4);font-size:11px;">Don't want birthday rewards? <a href="#" style="color:rgba(255,255,255,0.6);">Unsubscribe</a>.</p>`,
  });

  return send({
    to,
    subject: `[Sellora] Happy Birthday! Here's your ${discountPercent}% off gift 🎁`,
    html,
    templateName: "birthday",
    accountId,
    allowUnsubscribe: true,
    unsubscribeType: "marketing",
    metadata: { customerName, rewardCode, discountPercent },
  });
}

/**
 * 12. Win-back Email — sent by revenue automation to dormant customers
 */
export async function sendWinbackEmail({ to, customerName, discountCode, discountPercent, accountId }) {
  const html = layout({
    preheader: `We miss you, ${customerName}! Here's ${discountPercent}% off`,
    bodyContent: `
      <h1>We miss you! 💜</h1>
      <p>Hi ${escapeHtml(customerName)}, we noticed you haven't shopped with us in a while — and we'd love to have you back.</p>
      <div class="success-box">
        <div class="success-label">Welcome Back Offer</div>
        <div class="success-text">Use the code below for <strong>${discountPercent}% off</strong> your next order.</div>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <div style="display:inline-block;background:linear-gradient(135deg,#6C5CE7,#a855f7);color:#fff;padding:16px 36px;border-radius:10px;font-size:24px;font-weight:800;letter-spacing:2px;">${escapeHtml(discountCode)}</div>
      </div>
      <p style="font-size:13px;color:#6b7280;text-align:center;">Valid for 14 days. One-time use only.</p>
    `,
    footerNote: `<p style="color:rgba(255,255,255,0.4);font-size:11px;">Don't want these emails? <a href="#" style="color:rgba(255,255,255,0.6);">Unsubscribe</a>.</p>`,
  });

  return send({
    to,
    subject: `[Sellora] We miss you! Here's ${discountPercent}% off to come back`,
    html,
    templateName: "winback",
    accountId,
    allowUnsubscribe: true,
    unsubscribeType: "marketing",
    metadata: { customerName, discountCode, discountPercent },
  });
}

/**
 * 13. Abandoned Cart Recovery Email — sent by cart recovery cron
 */
export async function sendAbandonedCartEmail({
  to,
  customerName,
  items,
  cartValue,
  currency = "EGP",
  step,
  discountCode,
  discountPercent,
  recoveryLink,
  accountId,
}) {
  const itemsList = (items || [])
    .slice(0, 5)
    .map((i) => `• ${escapeHtml(i.name || "Item")}`)
    .join("<br>");

  const discountBox =
    discountCode && discountPercent
      ? `<div class="success-box">
          <div class="success-label">${discountPercent}% Off — Just For You</div>
          <div class="success-text">Use code <strong>${escapeHtml(discountCode)}</strong> at checkout to save on your cart.</div>
        </div>`
      : "";

  const stepSubject =
    step === 1
      ? "Still thinking it over?"
      : step === 2
      ? `Here's ${discountPercent}% off to help you decide`
      : "Last chance — your cart is waiting";

  const html = layout({
    preheader: stepSubject,
    bodyContent: `
      <h1>${escapeHtml(stepSubject)}</h1>
      <p>Hi ${escapeHtml(customerName)}, your cart is still waiting for you:</p>
      <div class="info-box">
        <div class="info-text">${itemsList}</div>
      </div>
      ${discountBox}
      <p style="margin-top:20px;">
        <a href="${recoveryLink}" class="btn">Complete Your Order →</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">Total cart value: <strong>${currency} ${Number(cartValue || 0).toFixed(2)}</strong></p>
    `,
    footerNote: `<p style="color:rgba(255,255,255,0.4);font-size:11px;">Don't want cart reminders? <a href="#" style="color:rgba(255,255,255,0.6);">Unsubscribe</a>.</p>`,
  });

  return send({
    to,
    subject: `[Sellora] ${stepSubject}`,
    html,
    templateName: "abandoned_cart",
    accountId,
    allowUnsubscribe: true,
    unsubscribeType: "marketing",
    metadata: { step, customerName, cartValue, discountCode },
  });
}

// ═══════════════════════════════════════════════════════════════
//  HEALTH CHECKS
// ═══════════════════════════════════════════════════════════════
export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export function isEmailFromConfigured() {
  const from = process.env.RESEND_FROM_EMAIL;
  return !!from && from !== "onboarding@resend.dev";
}

export function getEmailHealth() {
  return {
    resendApiKey: !!process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || null,
    fromIsSandbox: !process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL === "onboarding@resend.dev",
    appUrl: APP_URL,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/**
 * Sellora Centralized Email Service — Powered by Resend
 *
 * All outgoing emails flow through this module.
 * Every function returns { success, messageId?, error? }.
 *
 * Usage:
 *   import { sendEscalationEmail, sendTeamInviteEmail, ... } from "@/lib/email";
 */

import { Resend } from "resend";

// ────────────────────────────────────────────────────────
//  HTML sanitization — prevents XSS in email templates
// ────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ────────────────────────────────────────────────────────
//  Resend client singleton (lazy-initialised)
// ────────────────────────────────────────────────────────
let _resend = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) return null;
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// ────────────────────────────────────────────────────────
//  Config
// ────────────────────────────────────────────────────────
const rawFromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
// If env var already contains angle brackets (e.g. "Sellora <email>"), use as-is.
// Otherwise wrap it: "email@example.com" → "Sellora <email@example.com>"
const FROM_DEFAULT = rawFromEmail.includes("<")
  ? rawFromEmail
  : `Sellora <${rawFromEmail}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL || "sellora-ruby.vercel.app"}`;

// ────────────────────────────────────────────────────────
//  Core send helper
// ────────────────────────────────────────────────────────
async function send({ to, subject, html, replyTo, from }) {
  const resend = getResend();
  if (!resend) {
    console.warn("[EMAIL] RESEND_API_KEY not configured — email skipped.");
    console.warn(`[EMAIL] Would send to ${to}: ${subject}`);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from || FROM_DEFAULT,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo && { reply_to: replyTo }),
    });

    if (error) {
      console.error("[EMAIL] Resend error:", error);
      return { success: false, error: error.message || error };
    }

    console.log(`[EMAIL] Sent to ${to} — id=${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[EMAIL] Exception:", err.message);
    return { success: false, error: err.message };
  }
}

// ────────────────────────────────────────────────────────
//  Shared layout wrapper (branding, header, footer)
// ────────────────────────────────────────────────────────
function layout({ preheader, bodyContent, footerNote }) {
  const year = new Date().getFullYear();
  const logoUrl = `${APP_URL}/logo.png`;
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
    .logo { display:flex; align-items:center; gap:14px; }
    .logo-img { width:52px; height:52px; border-radius:12px; background:rgba(255,255,255,0.95); padding:6px; box-shadow:0 4px 14px rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.3); object-fit:contain; display:block; }
    .logo-text { color:#fff; font-size:22px; font-weight:800; letter-spacing:-0.5px; line-height:1; }
    .logo-text .ai { color:rgba(255,255,255,0.75); font-weight:600; font-size:13px; margin-left:6px; letter-spacing:1.5px; }
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
    .footer .footer-brand { display:flex; align-items:center; gap:10px; color:#fff; font-weight:800; font-size:16px; margin-bottom:8px; }
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
        <img src="${logoUrl}" alt="Sellora" class="logo-img" width="52" height="52" />
        <div class="logo-text">Sellora<span class="ai">AI</span></div>
      </div>
      <p class="tagline">Smart commerce, on autopilot</p>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      <div class="footer-brand">
        <img src="${logoUrl}" alt="Sellora" width="28" height="28" style="vertical-align:middle;margin-right:10px;border-radius:6px;background:rgba(255,255,255,0.1);padding:3px;" />
        Sellora<span class="ai">AI</span>
      </div>
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

// ════════════════════════════════════════════════════════
//  EMAIL TEMPLATES
// ════════════════════════════════════════════════════════

/**
 * 1. AI Escalation Alert — sent when the AI can't handle a conversation
 */
export async function sendEscalationEmail({ to, customerName, channel, reason, conversationId }) {
  const channelLabel = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp" }[channel] || channel;
  const convoLink = `${APP_URL}/dashboard/conversations`;

  const html = layout({
    preheader: `AI needs your help — ${customerName} on ${channelLabel}`,
    bodyContent: `
      <div class="alert-box">
        <div class="alert-label">AI Needs Your Help</div>
        <div class="alert-text">Your AI assistant couldn't fully handle a customer conversation and is requesting human intervention.</div>
      </div>
      <table>
        <tr><td class="label">Customer</td><td class="value">${escapeHtml(customerName) || "Unknown"}</td></tr>
        <tr><td class="label">Channel</td><td class="value">${escapeHtml(channelLabel)}</td></tr>
        <tr><td class="label">Reason</td><td class="value" style="color:#DC2626;">${escapeHtml(reason)}</td></tr>
      </table>
      <p style="margin-top:20px;">
        <a href="${convoLink}" class="btn">View Conversation</a>
      </p>
      <p style="font-size:13px;color:#6b7280;margin-top:8px;">The AI has already responded to the customer and let them know a team member will follow up.</p>
    `,
  });

  return send({
    to,
    subject: `AI Escalation Alert — ${customerName} needs your help`,
    html,
  });
}

/**
 * 2. Team Invite — sent when an owner invites a new team member
 */
export async function sendTeamInviteEmail({ to, businessName, inviteLink }) {
  const html = layout({
    preheader: `You've been invited to join ${businessName || "a team"} on Sellora`,
    bodyContent: `
      <p>You have been invited to join <strong>${escapeHtml(businessName) || "a team"}</strong> on Sellora to help manage customer conversations.</p>
      <p>Click the button below to accept the invitation and set up your account:</p>
      <p><a href="${inviteLink}" class="btn">Accept Invitation</a></p>
      <div class="info-box">
        <div class="info-label">What you'll get</div>
        <div class="info-text">Access to the team dashboard, AI-powered conversation tools, and real-time customer insights.</div>
      </div>
      <p style="font-size:13px;color:#6b7280;">If you were not expecting this invitation, you can safely ignore this email.</p>
    `,
  });

  return send({
    to,
    subject: `You've been invited to join ${businessName || "a team"} on Sellora`,
    html,
  });
}

/**
 * 3. Welcome Email — sent after signup
 */
export async function sendWelcomeEmail({ to, fullName, businessName }) {
  const html = layout({
    preheader: `Welcome to Sellora, ${fullName}!`,
    bodyContent: `
      <p>Hey <strong>${escapeHtml(fullName)}</strong>, welcome to Sellora!</p>
      <p>Your store <strong>${escapeHtml(businessName) || "your business"}</strong> is all set up. Here's what you can do next:</p>
      <div class="info-box">
        <div class="info-label">Quick Start</div>
        <div class="info-text">
          1. Connect your Facebook &amp; Instagram pages<br>
          2. Add your products and catalog<br>
          3. Enable the AI assistant to auto-reply to customers<br>
          4. Watch your sales grow on autopilot
        </div>
      </div>
      <p><a href="${APP_URL}/dashboard" class="btn">Go to Dashboard</a></p>
      <p style="font-size:13px;color:#6b7280;">You're on a 14-day free trial. No credit card required.</p>
    `,
  });

  return send({
    to,
    subject: `Welcome to Sellora — let's get ${businessName || "you"} selling!`,
    html,
  });
}

/**
 * 4. Password Reset — sent when a user requests a password reset
 *    NOTE: Supabase handles password reset emails natively.
 *    This function is provided as an alternative if you want
 *    to use Resend instead of Supabase's built-in email.
 */
export async function sendPasswordResetEmail({ to, resetLink }) {
  const html = layout({
    preheader: "Reset your Sellora password",
    bodyContent: `
      <p>We received a request to reset the password for your Sellora account.</p>
      <p>Click the button below to set a new password:</p>
      <p><a href="${resetLink}" class="btn">Reset Password</a></p>
      <div class="alert-box">
        <div class="alert-label">Security Notice</div>
        <div class="alert-text">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</div>
      </div>
    `,
  });

  return send({
    to,
    subject: "Reset your Sellora password",
    html,
  });
}

/**
 * 5. Order Confirmation — sent to the business owner when a new order comes in
 */
export async function sendOrderConfirmationEmail({ to, orderNumber, customerName, items, total, currency = "EGP" }) {
  const itemsHtml = (items || []).map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${item.name || "Item"}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;">${item.quantity || 1}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${currency} ${(item.price || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  const html = layout({
    preheader: `New order #${orderNumber} from ${customerName}`,
    bodyContent: `
      <div class="success-box">
        <div class="success-label">New Order</div>
        <div class="success-text">You just received a new order from ${customerName}!</div>
      </div>
      <table>
        <tr><td class="label">Order #</td><td class="value">${escapeHtml(orderNumber)}</td></tr>
        <tr><td class="label">Customer</td><td class="value">${escapeHtml(customerName)}</td></tr>
      </table>
      <h3 style="margin-top:24px;font-size:15px;color:#374151;">Order Details</h3>
      <table style="margin-top:8px;">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb;">
            <th style="text-align:left;padding:8px 0;font-size:13px;color:#6b7280;">Item</th>
            <th style="text-align:center;padding:8px 0;font-size:13px;color:#6b7280;">Qty</th>
            <th style="text-align:right;padding:8px 0;font-size:13px;color:#6b7280;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:12px 0 0;font-weight:700;color:#111827;">Total</td>
            <td style="padding:12px 0 0;text-align:right;font-weight:700;color:#6C5CE7;font-size:16px;">${currency} ${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/dashboard/orders" class="btn">View Order</a>
      </p>
    `,
  });

  return send({
    to,
    subject: `New order #${orderNumber} — ${currency} ${total.toFixed(2)}`,
    html,
  });
}

/**
 * 6. Plan Upgrade Confirmation — sent after a successful subscription change
 */
export async function sendPlanUpgradeEmail({ to, planName, amount, currency = "USD", interval = "monthly" }) {
  const html = layout({
    preheader: `You're now on the ${planName} plan!`,
    bodyContent: `
      <div class="success-box">
        <div class="success-label">Plan Upgraded</div>
        <div class="success-text">Your account has been upgraded to the <strong>${escapeHtml(planName)}</strong> plan.</div>
      </div>
      <table>
        <tr><td class="label">Plan</td><td class="value">${planName}</td></tr>
        <tr><td class="label">Billing</td><td class="value">${currency} ${amount}/${interval === "annual" ? "year" : "month"}</td></tr>
      </table>
      <p style="margin-top:16px;">You now have access to all ${planName} features. Here's what's unlocked:</p>
      <div class="info-box">
        <div class="info-label">What's New</div>
        <div class="info-text">
          ${planName === "Professional" ? "Unlimited products, 2 channels, 1000 conversations/month, priority support." : planName === "Business" ? "Unlimited everything, 3 channels, AI-powered automation, dedicated support." : "All Starter features are now active."}
        </div>
      </div>
      <p><a href="${APP_URL}/dashboard/billing" class="btn">Manage Billing</a></p>
    `,
  });

  return send({
    to,
    subject: `Welcome to Sellora ${planName}!`,
    html,
  });
}

/**
 * 7. Weekly Summary — sent to business owners with their week's stats
 */
export async function sendWeeklySummaryEmail({ to, businessName, stats }) {
  const {
    totalConversations = 0,
    aiReplies = 0,
    newCustomers = 0,
    ordersCount = 0,
    revenue = 0,
    currency = "EGP",
    avgResponseTime = "N/A",
  } = stats || {};

  const html = layout({
    preheader: `Your weekly summary — ${businessName}`,
    bodyContent: `
      <p>Here's how <strong>${escapeHtml(businessName)}</strong> performed this week:</p>
      <table style="margin-top:12px;">
        <tr><td class="label">Conversations</td><td class="value">${totalConversations}</td></tr>
        <tr><td class="label">AI Replies</td><td class="value">${aiReplies}</td></tr>
        <tr><td class="label">New Customers</td><td class="value">${newCustomers}</td></tr>
        <tr><td class="label">Orders</td><td class="value">${ordersCount}</td></tr>
        <tr><td class="label">Revenue</td><td class="value" style="color:#059669;">${currency} ${revenue.toFixed(2)}</td></tr>
        <tr><td class="label">Avg Response</td><td class="value">${avgResponseTime}</td></tr>
      </table>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/dashboard" class="btn">View Dashboard</a>
      </p>
    `,
  });

  return send({
    to,
    subject: `Your weekly summary — ${totalConversations} conversations, ${currency} ${revenue.toFixed(2)} revenue`,
    html,
  });
}

/**
 * 8. Custom / Generic Email — for anything else
 */
export async function sendCustomEmail({ to, subject, html, from, replyTo }) {
  return send({ to, subject, html, from, replyTo });
}

// ────────────────────────────────────────────────────────
//  Health check — verify Resend is configured
// ────────────────────────────────────────────────────────
export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Wrap raw HTML body content in the branded Sellora email layout.
 */
export function wrapInLayout({ preheader, bodyContent, footerNote }) {
  return layout({ preheader, bodyContent, footerNote });
}

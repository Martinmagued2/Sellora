/**
 * Public Webhook Health Check
 * GET /api/webhooks/health
 *
 * No auth required. Returns ONLY whether each webhook env var is set
 * (yes/no), the expected webhook URLs to register in Meta, and a
 * verification test endpoint for each channel.
 *
 * This is safe to expose publicly because it doesn't leak secrets,
 * tokens, or account data — just "is this env var set? yes/no".
 */

import { NextResponse } from "next/server";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.sellorachat.com";

  const envVars = {
    // WhatsApp
    WHATSAPP_APP_SECRET: !!process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    WHATSAPP_ACCESS_TOKEN: !!process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    // Instagram + Facebook (Meta)
    META_APP_ID: !!process.env.NEXT_PUBLIC_META_APP_ID,
    META_APP_SECRET: !!process.env.META_APP_SECRET,
    META_WEBHOOK_VERIFY_TOKEN: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    // AI providers
    NVIDIA_API_KEY: !!process.env.NVIDIA_API_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    // Email
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || null,
  };

  // Build the expected webhook URLs
  const webhookUrls = {
    whatsapp: `${appUrl}/api/webhooks/whatsapp`,
    instagram: `${appUrl}/api/webhooks/instagram`,
    facebook: `${appUrl}/api/webhooks/facebook`,
    telegram: `${appUrl}/api/webhooks/telegram`,
    email: `${appUrl}/api/webhooks/email`,
    resend: `${appUrl}/api/webhooks/resend`,
  };

  // Build the issues list
  const issues = [];

  // WhatsApp issues
  if (!envVars.WHATSAPP_APP_SECRET) {
    issues.push({
      channel: "whatsapp",
      severity: "critical",
      message: "WHATSAPP_APP_SECRET is not set. Incoming WhatsApp messages will be rejected (401).",
      fix: "Add WHATSAPP_APP_SECRET to Vercel env vars. Find it in Meta App Dashboard → WhatsApp → Configuration → App Secret.",
    });
  }
  if (!envVars.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    issues.push({
      channel: "whatsapp",
      severity: "critical",
      message: "WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set. You cannot register the WhatsApp webhook URL with Meta.",
      fix: "Add WHATSAPP_WEBHOOK_VERIFY_TOKEN to Vercel env vars. Pick any secure string (e.g. 'sellora_wa_verify_abc123'). Use the SAME value when registering the webhook in Meta dashboard.",
    });
  }

  // Instagram/Facebook issues
  if (!envVars.META_APP_SECRET) {
    issues.push({
      channel: "instagram+facebook",
      severity: "critical",
      message: "META_APP_SECRET is not set. Incoming Instagram + Facebook messages will be rejected (401).",
      fix: "Add META_APP_SECRET to Vercel env vars. Find it in Meta App Dashboard → Settings → Basic → App Secret.",
    });
  }
  if (!envVars.META_WEBHOOK_VERIFY_TOKEN) {
    issues.push({
      channel: "instagram+facebook",
      severity: "critical",
      message: "META_WEBHOOK_VERIFY_TOKEN is not set. You cannot register the IG/FB webhook URL with Meta.",
      fix: "Add META_WEBHOOK_VERIFY_TOKEN to Vercel env vars. Pick any secure string (e.g. 'sellora_meta_verify_abc123'). Use the SAME value when registering the webhook in Meta dashboard.",
    });
  }

  // Email issues
  if (!envVars.RESEND_API_KEY) {
    issues.push({
      channel: "email",
      severity: "high",
      message: "RESEND_API_KEY is not set. Outbound emails (welcome, password reset, weekly summary, etc.) will not send.",
      fix: "Add RESEND_API_KEY to Vercel env vars. Get it from Resend dashboard → API Keys.",
    });
  }
  if (!envVars.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL === "onboarding@resend.dev") {
    issues.push({
      channel: "email",
      severity: "high",
      message: "RESEND_FROM_EMAIL is not set (or is using Resend's sandbox address). Emails will only deliver to the Resend account owner.",
      fix: "Set RESEND_API_KEY to a verified domain address like 'support@sellorachat.com' in Vercel env vars.",
    });
  }

  // AI issues
  if (!envVars.NVIDIA_API_KEY && !envVars.GROQ_API_KEY && !envVars.GOOGLE_GENERATIVE_AI_API_KEY) {
    issues.push({
      channel: "ai",
      severity: "critical",
      message: "No AI provider API key is set. AI auto-replies will fail.",
      fix: "Add at least one of: NVIDIA_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to Vercel env vars.",
    });
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    app_url: appUrl,
    webhook_urls: webhookUrls,
    env_vars: envVars,
    issues: issues,
    all_healthy: issues.filter((i) => i.severity === "critical").length === 0,
    next_steps: issues.length === 0
      ? "All webhook env vars are set. Make sure the webhook URLs above are registered in your Meta dashboard (https://developers.facebook.com/apps)."
      : "Fix the issues above. After fixing, redeploy on Vercel and re-check this endpoint.",
  });
}

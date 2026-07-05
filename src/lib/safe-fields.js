/**
 * Safe account fields for client-side queries.
 *
 * SECURITY: Never use select("*") on the accounts table from client-side code.
 * This excludes sensitive fields like:
 * - totp_secret (2FA secret key)
 * - totp_backup_codes (2FA backup codes)
 * - last_totp_time_step (TOTP replay protection)
 * - instagram_access_token, facebook_access_token, whatsapp_access_token
 * - shopify_access_token
 * - stripe_customer_id, stripe_subscription_id
 * - shopify_webhook_verify_token
 *
 * These fields should only be accessed server-side via the service role key.
 */
export const SAFE_ACCOUNT_FIELDS = [
  // Identity
  "id", "email", "business_name", "business_description", "industry",
  "logo_url", "phone", "country", "currency", "role",
  // Social URLs
  "instagram_url", "facebook_url", "website_url",
  // AI & Automation
  "ai_enabled", "ai_personality", "notify_escalations",
  "auto_greeting", "auto_greeting_message", "greeting_per_channel",
  "instagram_greeting", "facebook_greeting", "whatsapp_greeting",
  "greeting_delay_seconds", "auto_follow_up_enabled",
  // Abandoned Cart
  "abandoned_cart_enabled", "abandoned_cart_hours",
  "abandoned_cart_auto_reminder", "abandoned_cart_reminder_hours",
  "abandoned_cart_auto_second_reminder", "abandoned_cart_second_reminder_hours",
  "abandoned_cart_discount_percent",
  // Channel Connections (booleans + IDs only, NOT tokens)
  "instagram_connected", "facebook_connected", "whatsapp_connected",
  "shopify_installed",
  "instagram_page_id", "facebook_page_id", "whatsapp_phone_number_id",
  // Telegram + Email channels (booleans + public identifiers only)
  "telegram_connected", "telegram_bot_username", "telegram_webhook_verified",
  "email_channel_enabled", "email_inbound_address",
  // Plan & Billing
  "plan", "plan_status", "subscription_ends_at", "trial_ends_at",
  "billing_address", "notification_prefs",
  // Onboarding
  "onboarding_completed",
  // 2FA status (boolean only, never the secret)
  "totp_enabled",
  // Referrals
  "referral_code", "referral_credits",
].join(", ");

import { describe, it, expect } from "vitest";
import { SAFE_ACCOUNT_FIELDS } from "@/lib/safe-fields";

// ─── Helpers ──────────────────────────────────────────────
// SAFE_ACCOUNT_FIELDS is exported as a comma-separated string (for use
// directly in supabase `.select()` calls). Parse it into a Set of field
// names for easier testing.
function getSafeFieldSet() {
  return new Set(
    SAFE_ACCOUNT_FIELDS.split(",")
      .map((f) => f.trim())
      .filter(Boolean)
  );
}

// ─── Format ───────────────────────────────────────────────
describe("SAFE_ACCOUNT_FIELDS format", () => {
  it("is a non-empty string", () => {
    expect(typeof SAFE_ACCOUNT_FIELDS).toBe("string");
    expect(SAFE_ACCOUNT_FIELDS.length).toBeGreaterThan(0);
  });

  it("uses comma-space separator (', ') compatible with supabase .select()", () => {
    // The string is intended to be passed verbatim to `.select(SAFE_ACCOUNT_FIELDS)`,
    // so it must use ", " as the field separator.
    expect(SAFE_ACCOUNT_FIELDS).toMatch(/^id,\s/);
    // No field should contain commas inside it (each field is a single column name)
    const fields = SAFE_ACCOUNT_FIELDS.split(",").map((f) => f.trim()).filter(Boolean);
    for (const f of fields) {
      expect(f).not.toContain(",");
    }
  });

  it("contains no duplicate fields", () => {
    const fields = SAFE_ACCOUNT_FIELDS.split(",").map((f) => f.trim()).filter(Boolean);
    const set = new Set(fields);
    expect(set.size).toBe(fields.length);
  });
});

// ─── Known sensitive fields MUST be excluded ──────────────
describe("SAFE_ACCOUNT_FIELDS excludes sensitive columns", () => {
  // The list of columns that hold secrets, tokens, or replay-protection
  // data and must NEVER be sent to the client.
  const SENSITIVE_FIELDS = [
    // 2FA / TOTP
    "totp_secret",
    "totp_backup_codes",
    "last_totp_time_step",
    // Channel access tokens
    "instagram_access_token",
    "facebook_access_token",
    "whatsapp_access_token",
    "shopify_access_token",
    "telegram_bot_token",
    // Webhook verify tokens
    "shopify_webhook_verify_token",
    "whatsapp_webhook_verify_token",
    // Stripe IDs (PII / billing identifiers)
    "stripe_customer_id",
    "stripe_subscription_id",
    // Email channel password
    "email_imap_password",
    // SMS / carrier API keys
    "sms_api_key",
    "carrier_arjamex_api_key",
    "carrier_bosta_api_key",
    "carrier_mylerz_api_key",
    "aftership_api_key",
  ];

  it.each(SENSITIVE_FIELDS)("does NOT expose '%s'", (field) => {
    const safe = getSafeFieldSet();
    expect(safe.has(field)).toBe(false);
  });

  it("the full sensitive-field list is non-empty", () => {
    expect(SENSITIVE_FIELDS.length).toBeGreaterThan(0);
  });
});

// ─── Known safe fields MUST be present ────────────────────
describe("SAFE_ACCOUNT_FIELDS includes safe columns", () => {
  const SAFE_FIELDS_EXPECTED = [
    // Identity
    "id", "email", "business_name", "business_description", "industry",
    "logo_url", "phone", "country", "currency", "role",
    // Social URLs
    "instagram_url", "facebook_url", "website_url",
    // AI & Automation
    "ai_enabled", "ai_personality", "notify_escalations",
    "auto_greeting", "auto_greeting_message",
    // Plan & Billing
    "plan", "plan_status", "subscription_ends_at", "trial_ends_at",
    // Onboarding
    "onboarding_completed",
    // 2FA status (boolean only)
    "totp_enabled",
    // Referrals
    "referral_code", "referral_credits",
  ];

  it.each(SAFE_FIELDS_EXPECTED)("exposes '%s'", (field) => {
    const safe = getSafeFieldSet();
    expect(safe.has(field)).toBe(true);
  });
});

// ─── Boolean-only channel connection fields ───────────────
describe("SAFE_ACCOUNT_FIELDS exposes channel status booleans (not tokens)", () => {
  it("exposes instagram_connected but NOT instagram_access_token", () => {
    const safe = getSafeFieldSet();
    expect(safe.has("instagram_connected")).toBe(true);
    expect(safe.has("instagram_access_token")).toBe(false);
  });

  it("exposes facebook_connected but NOT facebook_access_token", () => {
    const safe = getSafeFieldSet();
    expect(safe.has("facebook_connected")).toBe(true);
    expect(safe.has("facebook_access_token")).toBe(false);
  });

  it("exposes whatsapp_connected but NOT whatsapp_access_token", () => {
    const safe = getSafeFieldSet();
    expect(safe.has("whatsapp_connected")).toBe(true);
    expect(safe.has("whatsapp_access_token")).toBe(false);
  });

  it("exposes shopify_installed but NOT shopify_access_token", () => {
    const safe = getSafeFieldSet();
    expect(safe.has("shopify_installed")).toBe(true);
    expect(safe.has("shopify_access_token")).toBe(false);
  });

  it("exposes totp_enabled (boolean) but NOT totp_secret", () => {
    const safe = getSafeFieldSet();
    expect(safe.has("totp_enabled")).toBe(true);
    expect(safe.has("totp_secret")).toBe(false);
  });
});

// ─── Boundary: substring attacks ──────────────────────────
describe("SAFE_ACCOUNT_FIELDS is not fooled by substring matches", () => {
  // `safe.has('instagram_access_token')` is an exact-match check, so
  // ensure a field like `instagram_access_token_url` (which would NOT be
  // safe) is also excluded if it's not in the safe list.
  it("does not contain 'token' or 'secret' in any field name", () => {
    const safe = getSafeFieldSet();
    const offenders = [...safe].filter(
      (f) => /token|secret|password|api_key/i.test(f)
    );
    expect(offenders).toEqual([]);
  });
});

---
Task ID: 1
Agent: Main Agent
Task: Full codebase audit and critical security fixes for Sellora

Work Log:
- Explored entire project structure (Next.js 16 SaaS app with 100+ API routes, Supabase, Stripe/Paymob payments, WhatsApp/Instagram/Facebook messaging)
- Launched 4 parallel audit agents covering: Security/Auth, API Routes, Database/Migrations, Integrations
- Identified 75+ findings across all areas (19 security, 27 API, 39 database, 27 integration)
- Prioritized and started fixing critical-must items

Stage Summary:
- Comprehensive audit complete with findings categorized by severity
- Applied fixes for all 🔴 CRITICAL items and several 🟠 HIGH items
- Key fixes applied:
  1. Added admin auth to 9 unauthenticated endpoints (db/migrate, db/migrate-accounts, webhooks/test-incoming, webhooks/test-ai, webhooks/status, ai/debug GET, storage/ensure-buckets, team/invite, meta/connect)
  2. Fixed TOTP timing attack (replaced === with crypto.timingSafeEqual)
  3. Fixed TOTP encryption fallback to plaintext (now throws instead of storing plaintext)
  4. Removed TOTP_ENCRYPTION_KEY fallback to SUPABASE_SERVICE_ROLE_KEY
  5. Removed client-trusted discount_amount from Paymob order-checkout
  6. Added PAYMOB_HMAC_SECRET null check before verification
  7. Added HTML escaping (escapeHtml) to all email templates (XSS fix)
  8. Fixed migration 035 duplicate policy name (added DROP POLICY IF EXISTS)
  9. Fixed timing-unsafe admin key comparisons in setup-db, admin/migrate, email/test
  10. Fixed middleware auth bypass when Supabase env vars missing
  11. Added GET API rate limiting (new api_read tier)
  12. Removed token previews from debug endpoints
  13. Fixed internal error message leakage in paymob/order-status
  14. Added user session auth to /api/automation/follow-up (was fully unauthenticated; now validates account_id matches authenticated user)
  15. Added user session auth to /api/automation/order-status-update + removed raw `message` body param (message injection prevention — only status-based templates used)
  16. Added user session auth + IP rate limiting (10/60s) + fixed err.message leak to /api/abandoned-carts/send-reminder
  17. Added cron secret (x-cron-secret) or admin auth to /api/campaigns/process-scheduled; replaced Authorization Bearer with x-internal-key header for internal fetch
  18. Added user session or admin auth + 24h per-account rate limit to /api/email/weekly-summary (checks weekly_summary_sent_at timestamp)

---
Task ID: 2
Agent: Main Agent
Task: Fix build error and coupon validation bug in AI agents

Work Log:
- Investigated build error: `agents.js:129:11 Expected ';', got 'ident'`
- Found root cause: `getSalesAgentPrompt` template literal was missing closing backtick on line 125 — the `}` on line 126 was inside the template literal instead of closing the function
- Fixed by adding the missing backtick: `Use them when necessary!`; (was `Use them when necessary!`)
- Verified build succeeds after fix (Next.js 16.2.4 Turbopack compiled successfully)
- Investigated coupon validation bug: AI was calling `validate_coupon` with empty `{"code": ""}` instead of the actual code the customer provided
- Root cause: The broken template literal meant the entire `agents.js` module failed to parse, so the AI was running without the proper system prompt that instructs it how to extract and pass coupon codes
- Enhanced `validate_coupon` tool descriptions in both `createSalesTools` and `createSupportTools` to be more explicit about extracting the exact coupon code from the customer's message
- Changed tool description from generic to explicit: "IMPORTANT: You MUST extract the exact coupon code from the customer's message (e.g. if they say 'MAR10' or 'I have code SUMMER50', pass 'MAR10' or 'SUMMER50' as the code parameter). NEVER pass an empty string."
- Changed schema description for `code` parameter from "The coupon code to validate" to "The exact coupon code the customer provided (e.g. 'MAR10', 'SUMMER50'). Must NOT be empty."
- Verified build still succeeds after tool description changes

Stage Summary:
- Build error fixed: Missing backtick in `getSalesAgentPrompt` template literal (agents.js line 125)
- Coupon validation bug fixed: Root cause was broken template literal preventing agent prompts from loading; enhanced tool descriptions as extra safeguard
- Both `createSalesTools` and `createSupportTools` `validate_coupon` tools now have explicit instructions for code extraction

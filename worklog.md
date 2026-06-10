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

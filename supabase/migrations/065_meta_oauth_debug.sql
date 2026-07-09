-- 065_meta_oauth_debug.sql
-- Stores full diagnostic data from each Meta OAuth callback attempt.
-- This lets us see EXACTLY what Facebook returned at each step,
-- which is critical for debugging "No Facebook Pages found" errors.

CREATE TABLE IF NOT EXISTS meta_oauth_debug (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id      TEXT NOT NULL,
  platform        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Step results (each is a JSON object with status, raw_response, etc.)
  -- We store everything as JSONB so the schema is flexible.
  token_exchange_short    JSONB,  -- response from /oauth/access_token (grant_type=authorization_code)
  token_exchange_long     JSONB,  -- response from /oauth/access_token (grant_type=fb_exchange_token)
  granular_scopes         JSONB,  -- target_ids extracted from short-lived token's granular_scopes
  permissions             JSONB,  -- /me/permissions response
  user_profile            JSONB,  -- /me response (user_id, name)
  strategy_accounts_short JSONB,  -- Strategy F: /me/accounts with SHORT-LIVED token (new)
  strategy_accounts_long  JSONB,  -- Strategy A: /me/accounts with long-lived token
  strategy_user_accounts  JSONB,  -- Strategy C: /{user-id}/accounts
  strategy_businesses     JSONB,  -- Strategy D: /me/businesses → owned_pages
  strategy_granular_pages JSONB,  -- Strategy E: direct page lookup using target_ids

  -- Final outcome
  final_page_id           TEXT,
  final_page_name         TEXT,
  final_outcome           TEXT,   -- 'success' | 'no_pages' | 'pages_perm_declined' | 'no_instagram_account' | 'error'
  error_detail            TEXT,

  -- Convenience: which strategy succeeded (A | B | C | D | E | F)
  winning_strategy        TEXT
);

CREATE INDEX IF NOT EXISTS idx_meta_oauth_debug_account
  ON meta_oauth_debug (account_id, created_at DESC);

COMMENT ON TABLE meta_oauth_debug IS
  'Diagnostic log for Meta OAuth callback attempts. Used to debug "No Facebook Pages found" errors by showing the raw Graph API responses at each step.';

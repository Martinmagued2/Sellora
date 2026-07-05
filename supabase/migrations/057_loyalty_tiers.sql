-- ============================================================
-- Migration 057: Customer Loyalty Tiers
-- Item #8 — Bronze / Silver / Gold / Platinum tier system
-- Each tier has: points_threshold, discount_percent, name, color, perks (jsonb)
-- When a customer's points cross a threshold, the tier is auto-assigned
-- and a congratulatory message is queued / sent.
-- ============================================================

-- ═══ 1. loyalty_tiers table ═══
-- Stores tier definitions. Seeded with the 4 default tiers but the
-- merchant can later customise discount_percent / perks for their store.
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,  -- NULL = global default tier
  name TEXT NOT NULL CHECK (name IN ('bronze', 'silver', 'gold', 'platinum')),
  display_name TEXT NOT NULL,                                  -- "Bronze", "Silver", ...
  points_threshold INTEGER NOT NULL DEFAULT 0,                 -- min lifetime_points to qualify
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,            -- applied to all orders for tier members
  color TEXT NOT NULL DEFAULT '#8E9297',                       -- hex color used in UI
  icon TEXT DEFAULT NULL,                                      -- emoji / lucide name
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,                    -- [{ "label": "Free shipping", "value": "Over 500 EGP" }, ...]
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_account
  ON loyalty_tiers(account_id, sort_order);

-- RLS — owners can manage their own custom tiers; everyone can read defaults
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own loyalty_tiers" ON loyalty_tiers;
CREATE POLICY "Users can manage own loyalty_tiers"
  ON loyalty_tiers FOR ALL
  USING (account_id = auth.uid() OR account_id IS NULL)
  WITH CHECK (account_id = auth.uid() OR account_id IS NULL);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_loyalty_tiers_updated_at ON loyalty_tiers;
CREATE TRIGGER update_loyalty_tiers_updated_at
  BEFORE UPDATE ON loyalty_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══ 2. Link loyalty_accounts to a specific tier row ═══
-- loyalty_accounts.tier (TEXT) already exists from migration 042
-- ("bronze" / "silver" / "gold" / "platinum"). We add a foreign-key
-- column for richer joins and a timestamp for when the tier was awarded.
ALTER TABLE loyalty_accounts
  ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tier_awarded_at TIMESTAMPTZ;

-- ═══ 3. Tier upgrade notifications table ═══
-- We log every tier-upgrade event so we can de-duplicate the
-- congratulatory message and audit the customer journey.
CREATE TABLE IF NOT EXISTS loyalty_tier_upgrades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  previous_tier TEXT,
  new_tier TEXT NOT NULL,
  points_at_upgrade INTEGER NOT NULL,
  message_sent BOOLEAN DEFAULT FALSE,
  message_channel TEXT,                                        -- 'whatsapp' | 'instagram' | 'facebook' | 'none'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_upgrades_customer
  ON loyalty_tier_upgrades(account_id, customer_id, created_at DESC);

ALTER TABLE loyalty_tier_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own loyalty_tier_upgrades" ON loyalty_tier_upgrades;
CREATE POLICY "Users can read own loyalty_tier_upgrades"
  ON loyalty_tier_upgrades FOR SELECT USING (account_id = auth.uid());

-- ═══ 4. Seed the four default tiers (account_id = NULL ⇒ global defaults) ═══
INSERT INTO loyalty_tiers
  (account_id, name, display_name, points_threshold, discount_percent, color, icon, perks, sort_order)
VALUES
  (NULL, 'bronze',   'Bronze',     0,     0.00,  '#CD7F32', '🥉',
    '["Earn 1 point per 1 EGP spent","Access to member-only coupons","Birthday surprise gift"]'::jsonb, 0),
  (NULL, 'silver',   'Silver',     1000,  5.00,  '#C0C0C0', '🥈',
    '["5% discount on every order","Free shipping over 500 EGP","Priority customer support","Early access to sales"]'::jsonb, 1),
  (NULL, 'gold',     'Gold',       5000,  10.00, '#FFD700', '🥇',
    '["10% discount on every order","Free shipping on all orders","Dedicated loyalty concierge","Exclusive Gold-only drops","Free gift wrapping"]'::jsonb, 2),
  (NULL, 'platinum', 'Platinum',   20000, 15.00, '#E5E4E2', '💎',
    '["15% discount on every order","Free express shipping on all orders","Personal shopping assistant","Invitations to VIP events","Annual mystery box","Extended 60-day returns"]'::jsonb, 3)
ON CONFLICT (account_id, name) DO NOTHING;

-- ═══ 5. Backfill tier_id for existing loyalty_accounts ═══
-- Any account already on a tier gets linked to the matching global tier row.
UPDATE loyalty_accounts la
SET tier_id = lt.id,
    tier_awarded_at = COALESCE(la.tier_awarded_at, la.updated_at, NOW())
FROM loyalty_tiers lt
WHERE lt.account_id IS NULL
  AND la.tier_id IS NULL
  AND la.tier = lt.name;

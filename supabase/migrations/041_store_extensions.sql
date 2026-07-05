-- ============================================================
-- Migration 041: Store extensions for public storefront
-- Adds: whatsapp_number, instagram_handle, facebook_page,
--       banner_url, theme, contact_email, social_links
-- ============================================================

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS theme JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- Public can read published stores (for storefront)
DROP POLICY IF EXISTS "Public can read published stores" ON stores;
CREATE POLICY "Public can read published stores"
  ON stores FOR SELECT
  USING (is_published = TRUE AND is_active = TRUE);

-- Public can read active products for published stores
-- (already covered by existing policies since RLS checks account_id, but
-- we need an explicit public-read policy for the storefront)
DROP POLICY IF EXISTS "Public can read active products" ON products;
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM stores
      WHERE stores.account_id = products.account_id
      AND stores.is_published = TRUE
      AND stores.is_active = TRUE
    )
  );

-- Public can read published reviews (already added in migration 040)
-- (re-affirmed here for clarity)

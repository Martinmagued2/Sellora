-- ============================================================
-- Migration 043: Knowledge base, Subscriptions, Verified badge
-- ============================================================

-- ═══ 1. Knowledge Base (B4) — documents the AI can quote ═══
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'text' CHECK (source_type IN ('text', 'pdf', 'url', 'faq_import')),
  content TEXT NOT NULL,                          -- raw text content
  chunks JSONB DEFAULT '[]'::jsonb,               -- pre-split chunks for retrieval
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'embedded', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_account ON knowledge_documents(account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kb_embedding_status ON knowledge_documents(embedding_status);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own knowledge_documents" ON knowledge_documents;
CREATE POLICY "Users can manage own knowledge_documents"
  ON knowledge_documents FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- ═══ 2. Subscriptions / Recurring Orders (C6) ═══
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant TEXT,
  quantity INTEGER DEFAULT 1,
  frequency_days INTEGER NOT NULL DEFAULT 30,     -- every N days
  next_order_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  total_orders INTEGER DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  price_snapshot DECIMAL(10,2) NOT NULL,          -- price locked at subscription creation
  currency TEXT DEFAULT 'EGP',
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_account ON subscriptions(account_id, status);
CREATE INDEX IF NOT EXISTS idx_subs_next_order ON subscriptions(next_order_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subs_customer ON subscriptions(customer_id, status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON subscriptions;
CREATE POLICY "Users can manage own subscriptions"
  ON subscriptions FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- ═══ 3. Sellora Verified badge (G4) ═══
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS verified_status TEXT DEFAULT 'unverified' CHECK (verified_status IN ('unverified', 'pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_application JSONB DEFAULT '{}'::jsonb;

-- ═══ 4. Multi-image product visual similarity (B8) ═══
-- Store image embeddings for visual search
CREATE TABLE IF NOT EXISTS product_image_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  embedding JSONB NOT NULL,                       -- vector as JSON array (or pgvector if installed)
  model TEXT DEFAULT 'gemini-vision',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_emb_product ON product_image_embeddings(product_id);
CREATE INDEX IF NOT EXISTS idx_image_emb_account ON product_image_embeddings(account_id);

ALTER TABLE product_image_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own product_image_embeddings" ON product_image_embeddings;
CREATE POLICY "Users can manage own product_image_embeddings"
  ON product_image_embeddings FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- ═══ 5. VAPID push keys on accounts (per-tenant push) ═══
-- The push_subscriptions table exists from migration 029.
-- We add a column for the VAPID endpoint URL (fetched once per subscription).
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint_url TEXT,
  ADD COLUMN IF NOT EXISTS expiration_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

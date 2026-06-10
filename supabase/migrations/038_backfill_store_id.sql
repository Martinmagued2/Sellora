-- Migration 038: Backfill store_id for existing data
-- When store_id was added (migration 031), existing records had NULL store_id.
-- This caused queries with .eq("store_id", currentStoreId) to return no results.
-- This migration assigns existing data to the first store for each account,
-- so the store filter works correctly.

-- ════════════════════════════════════════════════════════════
-- 1. Backfill products.store_id
-- ════════════════════════════════════════════════════════════
UPDATE products p
SET store_id = s.id
FROM stores s
WHERE p.store_id IS NULL
  AND p.account_id = s.account_id
  AND s.id = (
    SELECT s2.id FROM stores s2
    WHERE s2.account_id = p.account_id
    ORDER BY s2.created_at ASC
    LIMIT 1
  );

-- ════════════════════════════════════════════════════════════
-- 2. Backfill orders.store_id
-- ════════════════════════════════════════════════════════════
UPDATE orders o
SET store_id = s.id
FROM stores s
WHERE o.store_id IS NULL
  AND o.account_id = s.account_id
  AND s.id = (
    SELECT s2.id FROM stores s2
    WHERE s2.account_id = o.account_id
    ORDER BY s2.created_at ASC
    LIMIT 1
  );

-- ════════════════════════════════════════════════════════════
-- 3. Backfill customers.store_id
-- ════════════════════════════════════════════════════════════
UPDATE customers c
SET store_id = s.id
FROM stores s
WHERE c.store_id IS NULL
  AND c.account_id = s.account_id
  AND s.id = (
    SELECT s2.id FROM stores s2
    WHERE s2.account_id = c.account_id
    ORDER BY s2.created_at ASC
    LIMIT 1
  );

-- ════════════════════════════════════════════════════════════
-- 4. Backfill conversations.store_id
-- ════════════════════════════════════════════════════════════
UPDATE conversations conv
SET store_id = s.id
FROM stores s
WHERE conv.store_id IS NULL
  AND conv.account_id = s.account_id
  AND s.id = (
    SELECT s2.id FROM stores s2
    WHERE s2.account_id = conv.account_id
    ORDER BY s2.created_at ASC
    LIMIT 1
  );

-- ════════════════════════════════════════════════════════════
-- 5. Backfill campaigns.store_id
-- ════════════════════════════════════════════════════════════
UPDATE campaigns camp
SET store_id = s.id
FROM stores s
WHERE camp.store_id IS NULL
  AND camp.account_id = s.account_id
  AND s.id = (
    SELECT s2.id FROM stores s2
    WHERE s2.account_id = camp.account_id
    ORDER BY s2.created_at ASC
    LIMIT 1
  );

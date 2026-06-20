import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// POST /api/integrations/shopify/fix-schema
// Adds the missing shopify_id column + unique constraint to the products table.
// Idempotent — safe to run multiple times.

const MANUAL_SQL = `-- Add shopify_id column to products table (idempotent)
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_id TEXT;

-- Create unique index for upsert onConflict: 'account_id, shopify_id'
-- Partial index — only applies when shopify_id IS NOT NULL, so manual
-- products (which have NULL shopify_id) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS products_account_id_shopify_id_key
  ON products(account_id, shopify_id)
  WHERE shopify_id IS NOT NULL;

-- Index for fast lookups by shopify_id
CREATE INDEX IF NOT EXISTS idx_products_shopify_id
  ON products(shopify_id)
  WHERE shopify_id IS NOT NULL;`;

export async function POST(req) {
  const log = [];

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Try exec_sql RPC first — works on Supabase projects that have it enabled
    const { error: colErr } = await adminClient.rpc('exec_sql', {
      sql_text: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_id TEXT;'
    });

    if (colErr) {
      log.push(`exec_sql not available: ${colErr.message}`);
      return NextResponse.json({
        success: false,
        needsManualSql: true,
        instructions: MANUAL_SQL,
        log,
      });
    }

    log.push('shopify_id column added');

    // Add unique index
    const { error: idxErr } = await adminClient.rpc('exec_sql', {
      sql_text: `CREATE UNIQUE INDEX IF NOT EXISTS products_account_id_shopify_id_key
        ON products(account_id, shopify_id)
        WHERE shopify_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_id) WHERE shopify_id IS NOT NULL;`
    });

    if (idxErr) {
      log.push(`index create failed: ${idxErr.message}`);
    } else {
      log.push('unique index created');
    }

    return NextResponse.json({ success: true, log });
  } catch (e) {
    console.error('[shopify/fix-schema] uncaught:', e);
    return NextResponse.json(
      { error: e?.message, log, needsManualSql: true, instructions: MANUAL_SQL },
      { status: 500 }
    );
  }
}

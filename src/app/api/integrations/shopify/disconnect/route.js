import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { decryptShopifyToken } from '@/lib/shopify';

export async function POST(req) {
  let userId = null;
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
    userId = user.id;

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Read the current row so we can revoke the Shopify access token
    //    (best practice — instantly invalidates the token server-side).
    const { data: account, error: accountError } = await adminClient
      .from('accounts')
      .select('id, shopify_shop_domain, shopify_access_token, shopify_installed')
      .eq('id', user.id)
      .maybeSingle();

    if (accountError) {
      console.error('[shopify/disconnect] select error:', accountError);
      return NextResponse.json(
        { error: 'Failed to read account: ' + (accountError.message || 'unknown error') },
        { status: 500 }
      );
    }

    if (!account) {
      // No row at all — nothing to disconnect. Treat as success so the UI
      // resets to the disconnected state.
      return NextResponse.json({ success: true, alreadyDisconnected: true });
    }

    // 2. Best-effort: revoke the Shopify access token via the store's
    //    /admin/api/current/oauth/revoke endpoint. We decrypt the stored
    //    token first. If decryption or revocation fails, we still clear
    //    the local row — the user just wants the connection gone.
    if (account.shopify_shop_domain && account.shopify_access_token) {
      try {
        const accessToken = decryptShopifyToken(account.shopify_access_token);
        if (accessToken) {
          await fetch(
            `https://${account.shopify_shop_domain}/admin/api/2024-04/oauth/revoke`,
            {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            }
          ).catch((e) => console.warn('[shopify/disconnect] revoke skipped:', e?.message || e));
        }
      } catch (decryptErr) {
        console.warn('[shopify/disconnect] token decrypt failed, continuing:', decryptErr?.message);
      }
    }

    // 3. Clear the Shopify columns on the accounts row.
    const { error: updateError, count } = await adminClient
      .from('accounts')
      .update({
        shopify_shop_domain: null,
        shopify_access_token: null,
        shopify_installed: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[shopify/disconnect] update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect: ' + (updateError.message || 'unknown error') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      wasConnected: account.shopify_installed === true,
    });
  } catch (err) {
    console.error('[shopify/disconnect] uncaught error (user=' + userId + '):', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error during disconnect' },
      { status: 500 }
    );
  }
}

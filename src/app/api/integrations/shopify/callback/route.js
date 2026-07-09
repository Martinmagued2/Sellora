import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { verifyShopifyOAuthHmac, encryptShopifyToken } from '@/lib/shopify';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const shop = url.searchParams.get('shop');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    const cookieStore = await cookies();
    const storedState = cookieStore.get('shopify_oauth_state')?.value;
    if (!state || state !== storedState) {
      return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
    }

    const hmacValid = verifyShopifyOAuthHmac(url);
    if (!hmacValid) {
      return NextResponse.json({ error: 'Invalid Shopify HMAC signature' }, { status: 400 });
    }

    if (!shop || !code) {
      return NextResponse.json({ error: 'Missing shop or code' }, { status: 400 });
    }

    const clientId = process.env.SHOPIFY_API_KEY;
    const clientSecret = process.env.SHOPIFY_API_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Shopify API credentials not configured' }, { status: 500 });
    }

    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      return NextResponse.json({ error: 'Failed to exchange token', details: body }, { status: 500 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const encryptedToken = encryptShopifyToken(accessToken);

    // Update account with shop info
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`;
      const redirect = NextResponse.redirect(`${appUrl}/dashboard/settings?tab=channels&shopify=connected`);
      return redirect;
    }

    const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await adminClient.from('accounts').update({
      shopify_shop_domain: shop,
      shopify_access_token: encryptedToken,
      shopify_installed: true,
    }).eq('id', user.id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`;
    return NextResponse.redirect(`${appUrl}/dashboard/settings?tab=channels&shopify=connected`);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}

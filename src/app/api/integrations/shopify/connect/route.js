import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop');
    if (!shop) {
      return NextResponse.json({ error: 'Missing shop parameter (e.g. your-shop.myshopify.com)' }, { status: 400 });
    }

    const clientId = process.env.SHOPIFY_API_KEY;
    const scopes = process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_orders';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`;
    const redirectUri = `${appUrl}/api/integrations/shopify/callback`;

    if (!clientId) {
      return NextResponse.json({ error: 'SHOPIFY_API_KEY not configured' }, { status: 500 });
    }

    const state = crypto.randomBytes(16).toString('hex');

    const oauthUrl = `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

    const res = NextResponse.redirect(oauthUrl);
    res.headers.append('Set-Cookie', `shopify_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}

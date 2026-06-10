import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');
    const shop = req.headers.get('x-shopify-shop-domain');

    // Verify HMAC signature if SHOPIFY_API_SECRET is configured
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (apiSecret && hmacHeader) {
      const generatedHash = crypto
        .createHmac('sha256', apiSecret)
        .update(rawBody, 'utf8')
        .digest('base64');

      try {
        const isValid = crypto.timingSafeEqual(
          Buffer.from(generatedHash, 'base64'),
          Buffer.from(hmacHeader, 'base64')
        );
        if (!isValid) {
          console.error('Invalid Shopify webhook HMAC signature');
          return new NextResponse('Invalid signature', { status: 401 });
        }
      } catch (e) {
        console.error('Shopify HMAC comparison error:', e.message);
        return new NextResponse('Invalid signature', { status: 401 });
      }
    } else if (apiSecret && !hmacHeader) {
      console.error('Shopify webhook missing HMAC header — rejecting');
      return new NextResponse('Missing HMAC signature', { status: 401 });
    }
    
    console.log(`Received Shopify Webhook: ${topic} for ${shop}`);

    if (topic === 'app/uninstalled') {
      // Remove token from DB for this shop
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      await supabase
        .from('accounts')
        .update({
          shopify_shop_domain: null,
          shopify_access_token: null,
          shopify_installed: false,
        })
        .eq('shopify_shop_domain', shop);
      
      console.log('App uninstalled by', shop);
    }

    return new NextResponse('Webhook processed', { status: 200 });
  } catch (err) {
    console.error('Shopify Webhook Error:', err);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

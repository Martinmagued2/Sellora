import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// GET  → returns current channel state + RLS test results (read-only, safe to call)
// POST → actually attempts to disconnect the channel specified by ?channel=instagram|facebook|whatsapp|shopify
export async function GET(req) {
  const debug = { ts: new Date().toISOString(), steps: [] };

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    debug.steps.push({ step: 'auth.getUser', ok: !!user, error: userErr?.message, userId: user?.id?.slice(0, 8) });

    if (!user) {
      debug.steps.push({ step: 'done', reason: 'no auth' });
      return NextResponse.json(debug, { status: 401 });
    }

    // Read with anon key (client-side view, what ChannelsTab sees)
    const { data: clientAccount, error: clientErr } = await supabase
      .from('accounts')
      .select('id, instagram_connected, facebook_connected, whatsapp_connected, shopify_installed, instagram_page_id, facebook_page_id, whatsapp_phone_number_id, shopify_shop_domain')
      .eq('id', user.id)
      .maybeSingle();

    debug.steps.push({
      step: 'client.select',
      ok: !clientErr,
      error: clientErr?.message,
      code: clientErr?.code,
      hasRow: !!clientAccount,
      state: clientAccount ? {
        ig: clientAccount.instagram_connected,
        fb: clientAccount.facebook_connected,
        wa: clientAccount.whatsapp_connected,
        shopify: clientAccount.shopify_installed,
      } : null,
    });

    // Test client-side UPDATE (no values changed) — this is what the Disconnect button does
    const { error: clientUpdateErr } = await supabase
      .from('accounts')
      .update({ instagram_connected: clientAccount?.instagram_connected ?? false })
      .eq('id', user.id);

    debug.steps.push({
      step: 'client.update.test (no-op)',
      ok: !clientUpdateErr,
      error: clientUpdateErr?.message,
      code: clientUpdateErr?.code,
    });

    return NextResponse.json(debug);
  } catch (e) {
    debug.steps.push({ step: 'uncaught', error: e?.message, stack: e?.stack?.split('\n').slice(0, 5) });
    return NextResponse.json(debug, { status: 500 });
  }
}

export async function POST(req) {
  const debug = { ts: new Date().toISOString(), steps: [] };

  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get('channel') || 'shopify';
    const validChannels = ['instagram', 'facebook', 'whatsapp', 'shopify'];
    if (!validChannels.includes(channel)) {
      return NextResponse.json({ error: `Invalid channel. Use one of: ${validChannels.join(', ')}` }, { status: 400 });
    }
    debug.channel = channel;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    debug.steps.push({ step: 'auth.getUser', ok: !!user, error: userErr?.message });
    if (!user) return NextResponse.json(debug, { status: 401 });

    // 1. Build the update payload for the requested channel (same fields ChannelsTab uses)
    const updatePayload = {
      instagram: { instagram_connected: false, instagram_page_id: null, instagram_access_token: null },
      facebook:  { facebook_connected: false,  facebook_page_id: null,  facebook_access_token: null },
      whatsapp:  { whatsapp_connected: false,  whatsapp_phone_number_id: null, whatsapp_access_token: null },
      shopify:   { shopify_installed: false,   shopify_shop_domain: null, shopify_access_token: null },
    }[channel];

    // 2. Try the client-side update (this is what the button does — uses anon key + RLS)
    const { data: clientUpdateData, error: clientUpdateErr } = await supabase
      .from('accounts')
      .update(updatePayload)
      .eq('id', user.id)
      .select('id');

    debug.steps.push({
      step: 'client.update',
      ok: !clientUpdateErr,
      error: clientUpdateErr?.message,
      code: clientUpdateErr?.code,
      rowsAffected: clientUpdateData?.length ?? 0,
    });

    // 3. If the client update failed OR affected 0 rows, retry with service role (bypasses RLS)
    if (clientUpdateErr || (clientUpdateData?.length ?? 0) === 0) {
      debug.steps.push({ step: 'service_role.fallback', reason: 'client update failed or affected 0 rows' });
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { data: adminData, error: adminErr } = await adminClient
        .from('accounts')
        .update(updatePayload)
        .eq('id', user.id)
        .select('id');

      debug.steps.push({
        step: 'service_role.update',
        ok: !adminErr,
        error: adminErr?.message,
        rowsAffected: adminData?.length ?? 0,
      });
    }

    // 4. Final state read
    const { data: final } = await supabase
      .from('accounts')
      .select('instagram_connected, facebook_connected, whatsapp_connected, shopify_installed')
      .eq('id', user.id)
      .maybeSingle();

    debug.finalState = final;
    return NextResponse.json(debug);
  } catch (e) {
    debug.steps.push({ step: 'uncaught', error: e?.message });
    return NextResponse.json(debug, { status: 500 });
  }
}

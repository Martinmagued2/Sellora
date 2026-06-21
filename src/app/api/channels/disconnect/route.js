import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Disconnect any messaging channel (instagram | facebook | whatsapp) server-side.
// This is more reliable than the client-side supabase.update() call because:
//   1. It uses the service role key as a fallback if RLS blocks the anon-key write.
//   2. It returns a structured error message the toast can surface.
//   3. It validates the row was actually updated (rowsAffected > 0).

const PAYLOADS = {
  instagram: { instagram_connected: false, instagram_page_id: null, instagram_access_token: null },
  facebook:  { facebook_connected: false,  facebook_page_id: null,  facebook_access_token: null },
  whatsapp:  { whatsapp_connected: false,  whatsapp_phone_number_id: null, whatsapp_access_token: null },
  shopify:   { shopify_installed: false,   shopify_shop_domain: null, shopify_access_token: null },
};

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get('channel');
    if (!channel || !PAYLOADS[channel]) {
      return NextResponse.json(
        { error: `Invalid channel. Use one of: ${Object.keys(PAYLOADS).join(', ')}` },
        { status: 400 }
      );
    }

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

    const updatePayload = PAYLOADS[channel];

    // 1. Try the client-side update first (uses anon key + RLS — what the old button did)
    const { data: clientData, error: clientErr } = await supabase
      .from('accounts')
      .update(updatePayload)
      .eq('id', user.id)
      .select('id');

    if (!clientErr && (clientData?.length ?? 0) > 0) {
      return NextResponse.json({ success: true, channel, method: 'client_anon' });
    }

    // 2. Fallback: service role (bypasses RLS). Safety net for missing/broken RLS policy.
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: adminData, error: adminErr } = await adminClient
      .from('accounts')
      .update(updatePayload)
      .eq('id', user.id)
      .select('id');

    if (adminErr) {
      console.error(`[channels/disconnect] service_role update failed for ${channel}:`, adminErr);
      return NextResponse.json(
        { error: `Failed to disconnect ${channel}: ${adminErr.message}` },
        { status: 500 }
      );
    }

    if ((adminData?.length ?? 0) === 0) {
      return NextResponse.json(
        { error: `No account row found for your user ID. Please contact support.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      channel,
      method: 'service_role_fallback',
      clientError: clientErr?.message || null,
    });
  } catch (e) {
    console.error('[channels/disconnect] uncaught:', e);
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}

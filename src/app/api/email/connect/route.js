import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// POST — enable email channel
// Body: { inboundAddress }
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { inboundAddress } = await req.json();
    if (!inboundAddress || !inboundAddress.includes('@')) {
      return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
    }

    const db = admin();
    await db.from('accounts').update({
      email_channel_enabled: true,
      email_inbound_address: inboundAddress.toLowerCase().trim(),
    }).eq('id', user.id);

    return NextResponse.json({
      success: true,
      inboundAddress,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sellora-ruby.vercel.app'}/api/webhooks/email`,
      instructions: `Forward emails from ${inboundAddress} to this webhook URL using your email provider's forwarding rules, or configure Resend/SendGrid/Mailgun inbound parse to POST to this URL.`,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to enable email channel' }, { status: 500 });
  }
}

// DELETE — disable email channel
export async function DELETE(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = admin();
    await db.from('accounts').update({
      email_channel_enabled: false,
      email_inbound_address: null,
    }).eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to disable email channel' }, { status: 500 });
  }
}

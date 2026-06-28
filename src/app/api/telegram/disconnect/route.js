import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';
import { deleteTelegramWebhook } from '@/lib/telegram';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = admin();
    const { data: account } = await db.from('accounts')
      .select('telegram_bot_token').eq('id', user.id).maybeSingle();

    if (account?.telegram_bot_token) {
      try {
        await deleteTelegramWebhook({ botToken: account.telegram_bot_token });
      } catch (e) {}
    }

    await db.from('accounts').update({
      telegram_bot_token: null,
      telegram_connected: false,
      telegram_bot_username: null,
      telegram_webhook_verified: false,
    }).eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

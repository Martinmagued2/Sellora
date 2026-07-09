import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';
import { setupTelegramWebhook, getBotInfo } from '@/lib/telegram';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

// POST — connect Telegram bot
// Body: { botToken }
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { botToken } = await req.json();
    if (!botToken || !botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      return NextResponse.json({ error: 'Invalid bot token format. Get it from @BotFather on Telegram.' }, { status: 400 });
    }

    // Verify the bot token by calling getMe
    let botInfo;
    try {
      botInfo = await getBotInfo({ botToken });
    } catch (e) {
      return NextResponse.json({ error: 'Invalid bot token: ' + e.message }, { status: 400 });
    }

    // Set up webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
    const webhookUrl = `${appUrl}/api/webhooks/telegram?token=${botToken}`;

    try {
      await setupTelegramWebhook({ botToken, webhookUrl });
    } catch (e) {
      return NextResponse.json({ error: 'Failed to set up webhook: ' + e.message }, { status: 500 });
    }

    // Save to account
    const db = admin();
    await db.from('accounts').update({
      telegram_bot_token: botToken,
      telegram_connected: true,
      telegram_bot_username: botInfo.username,
      telegram_webhook_verified: true,
    }).eq('id', user.id);

    return NextResponse.json({
      success: true,
      botUsername: botInfo.username,
      botName: botInfo.first_name,
    });
  } catch (e) {
    console.error('[telegram/connect]', e);
    return NextResponse.json({ error: 'Failed to connect Telegram bot' }, { status: 500 });
  }
}

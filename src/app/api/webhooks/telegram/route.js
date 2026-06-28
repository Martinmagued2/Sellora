import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseTelegramUpdate, downloadTelegramFile } from '@/lib/telegram';
import { processIncomingMessage } from '@/lib/channels/processor';
import { notify } from '@/lib/notifications';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = parseTelegramUpdate(body);

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const db = admin();

    // Find the account by bot token — the webhook URL includes the token
    // Actually, Telegram webhooks don't include the token in the URL.
    // We need to find the account by looking up which bot received this.
    // Strategy: check all accounts with telegram_connected=true and try each bot token.
    // Better strategy: include the bot token in the webhook URL path.
    // For now, we use a simpler approach: the webhook URL is /api/webhooks/telegram?token=<bot_token>

    const url = new URL(req.url);
    const botToken = url.searchParams.get('token');

    if (!botToken) {
      console.error('[TG-WEBHOOK] No bot token in URL');
      return NextResponse.json({ ok: true });
    }

    // Find account by bot token
    const { data: account } = await db.from('accounts')
      .select('id, telegram_bot_token')
      .eq('telegram_bot_token', botToken)
      .eq('telegram_connected', true)
      .maybeSingle();

    if (!account) {
      console.warn('[TG-WEBHOOK] No account found for this bot token');
      return NextResponse.json({ ok: true });
    }

    // Download media if present
    let mediaUrls = [];
    let mediaType = null;
    if (message.mediaId && message.mediaUrl) {
      try {
        const { buffer, mimeType } = await downloadTelegramFile({ botToken, fileId: message.MediaId || message.mediaUrl });
        const ext = mimeType.split('/')[1] || 'bin';
        const fileName = `inbound/${account.id}/${Date.now()}-tg.${ext}`;
        const { error: uploadError } = await db.storage.from('message-media').upload(fileName, buffer, { contentType: mimeType });
        if (!uploadError) {
          const { data: urlData } = db.storage.from('message-media').getPublicUrl(fileName);
          mediaUrls = [urlData.publicUrl];
          mediaType = message.mediaType;
        }
      } catch (e) {
        console.warn('[TG-WEBHOOK] Media download failed:', e.message);
      }
    }

    await processIncomingMessage({
      senderId: message.from,
      senderName: message.fromName,
      text: message.text,
      mediaUrls,
      mediaType,
      channel: 'telegram',
      pageId: botToken,
      platformMessageId: message.messageId,
      accessToken: botToken,
      accountId: account.id,
    });

    // Fire notification
    notify(account.id, {
      category: 'messages',
      type: 'new_message',
      title: `New Telegram message from ${message.fromName}`,
      message: (message.text || '').slice(0, 100),
      actionUrl: '/dashboard/conversations',
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[TG-WEBHOOK] Error:', err.message);
    return NextResponse.json({ ok: true }); // Always return 200 to prevent retries
  }
}

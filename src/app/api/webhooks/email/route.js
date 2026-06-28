import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processIncomingMessage } from '@/lib/channels/processor';
import { notify } from '@/lib/notifications';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

/**
 * POST /api/webhooks/email
 *
 * Inbound email webhook — receives emails forwarded from an email service
 * (e.g., Resend Inbound, Mailgun, Postmark, or a custom forwarding rule).
 *
 * The email service should be configured to POST parsed email data here:
 * {
 *   from: "customer@example.com",
 *   fromName: "John Doe",
 *   to: "support@sellora.com",
 *   subject: "Question about my order",
 *   text: "Hi, when will my order arrive?",
 *   html: "<p>Hi, when will my order arrive?</p>",
 *   attachments: [{ url, filename, contentType }]
 * }
 *
 * The `to` address is used to find the account that owns this email channel.
 */
export async function POST(req) {
  try {
    const body = await req.json();

    const { from, fromName, to, subject, text, html, attachments = [] } = body;

    if (!from || !text) {
      return NextResponse.json({ error: 'Missing from or text' }, { status: 400 });
    }

    const db = admin();

    // Find account by the inbound email address
    const { data: account } = await db.from('accounts')
      .select('id, email_channel_enabled, email_inbound_address')
      .eq('email_inbound_address', to)
      .eq('email_channel_enabled', true)
      .maybeSingle();

    if (!account) {
      // Try to find by matching the `to` address to any account's email_inbound_address
      const { data: accounts } = await db.from('accounts')
        .select('id, email_channel_enabled, email_inbound_address')
        .eq('email_channel_enabled', true);

      const matched = (accounts || []).find(a =>
        a.email_inbound_address?.toLowerCase() === to?.toLowerCase()
      );

      if (!matched) {
        console.warn('[EMAIL-WEBHOOK] No account found for:', to);
        return NextResponse.json({ ok: true });
      }
    }

    const accountId = account?.id || (accounts?.find(a => a.email_inbound_address?.toLowerCase() === to?.toLowerCase())?.id);
    if (!accountId) return NextResponse.json({ ok: true });

    // Extract media URLs from attachments
    const mediaUrls = (attachments || [])
      .filter(a => a.url)
      .map(a => a.url);

    // Use subject + text as the message content
    const messageText = subject ? `${subject}\n\n${text}` : text;

    await processIncomingMessage({
      senderId: from,
      senderName: fromName || from,
      text: messageText,
      mediaUrls,
      channel: 'email',
      pageId: to,
      platformMessageId: `email-${Date.now()}`,
      accessToken: null,
      accountId,
    });

    // Fire notification
    notify(accountId, {
      category: 'messages',
      type: 'new_message',
      title: `New email from ${fromName || from}`,
      message: (text || '').slice(0, 100),
      actionUrl: '/dashboard/conversations',
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[EMAIL-WEBHOOK] Error:', err.message);
    return NextResponse.json({ ok: true });
  }
}

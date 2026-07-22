import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
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
 * SECURITY: Verifies an HMAC-SHA256 signature using EMAIL_WEBHOOK_SECRET.
 * The email forwarder must send the header `x-email-signature` containing
 * base64(HMAC-SHA256(EMAIL_WEBHOOK_SECRET, rawRequestBody)).
 *
 * If EMAIL_WEBHOOK_SECRET is not set, the webhook rejects all requests
 * (fail closed). Do NOT allow "development mode" bypass — attackers can
 * inject fake customer messages into any account otherwise.
 *
 * Body shape:
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
    // SECURITY: Read raw body for signature verification BEFORE parsing.
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[EMAIL-WEBHOOK] EMAIL_WEBHOOK_SECRET is not set — rejecting (fail closed).');
      return NextResponse.json(
        { error: 'Webhook secret not configured. Set EMAIL_WEBHOOK_SECRET in env vars and configure your email forwarder to send the x-email-signature header.' },
        { status: 500 }
      );
    }

    // Verify HMAC-SHA256 signature
    const providedSig = req.headers.get('x-email-signature') || '';
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('base64');

    let signatureValid = false;
    try {
      const a = Buffer.from(providedSig);
      const b = Buffer.from(expectedSig);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        signatureValid = true;
      }
    } catch {
      // signature decode failed
    }

    if (!signatureValid) {
      console.warn('[EMAIL-WEBHOOK] Invalid signature — rejecting.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

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

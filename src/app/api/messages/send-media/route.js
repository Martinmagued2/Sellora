import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth-helper';
import { notify } from '@/lib/notifications';

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

/**
 * POST /api/messages/send-media
 *
 * Sends an audio or image message from the dashboard to the customer.
 * Body (multipart/form-data):
 *   - conversationId: string
 *   - type: 'audio' | 'image'
 *   - file: File (audio/webm, audio/mp3, image/jpeg, image/png, image/webp)
 *   - caption?: string (for images)
 *
 * The file is uploaded to Supabase Storage, then a message row is created
 * with media_url + media_type. For WhatsApp, the media is also sent via
 * the WhatsApp Business API.
 */
export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const conversationId = formData.get('conversationId');
    const type = formData.get('type'); // 'audio' or 'image'
    const file = formData.get('file');
    const caption = formData.get('caption') || '';

    if (!conversationId || !type || !file) {
      return NextResponse.json({ error: 'conversationId, type, and file are required' }, { status: 400 });
    }

    if (!['audio', 'image'].includes(type)) {
      return NextResponse.json({ error: 'Type must be audio or image' }, { status: 400 });
    }

    const db = admin();

    // Get conversation + account info
    const { data: conv, error: convError } = await db.from('conversations')
      .select(`
        id, channel, customer_id, account_id,
        customer:customers(id, name, phone, platform_id),
        account:accounts(id, whatsapp_access_token, whatsapp_phone_number_id, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id)
      `)
      .eq('id', conversationId)
      .eq('account_id', user.id)
      .maybeSingle();

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    // Validate file type
    const allowedAudio = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    const allowedImages = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const allowed = type === 'audio' ? allowedAudio : allowedImages;
    if (!allowed.includes(file.type)) {
      return NextResponse.json({
        error: `Invalid file type. Allowed: ${allowed.join(', ')}`,
      }, { status: 400 });
    }

    // Upload to Supabase Storage
    const fileName = `${type}/${conversationId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { data: uploadData, error: uploadError } = await db.storage
      .from('message-media')
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('[send-media] Upload error:', uploadError);
      // Try to create the bucket if it doesn't exist
      if (uploadError.message?.includes('Bucket not found')) {
        await db.storage.createBucket('message-media', { public: true });
        // Retry upload
        const retry = await db.storage.from('message-media').upload(fileName, file, { contentType: file.type });
        if (retry.error) {
          return NextResponse.json({ error: 'Failed to upload media: ' + retry.error.message }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'Failed to upload media: ' + uploadError.message }, { status: 500 });
      }
    }

    // Get public URL
    const { data: urlData } = db.storage.from('message-media').getPublicUrl(fileName);
    const mediaUrl = urlData.publicUrl;

    // Save message to database
    const { data: message, error: msgError } = await db.from('messages').insert({
      conversation_id: conversationId,
      account_id: user.id,
      direction: 'outgoing',
      content: caption || (type === 'audio' ? '🎤 Voice message' : '📷 Photo'),
      type,
      media_url: mediaUrl,
      media_type: file.type,
      is_ai: false,
    }).select().single();

    if (msgError) {
      console.error('[send-media] Message insert error:', msgError);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Update conversation's last_message_at
    await db.from('conversations')
      .update({ last_message_at: new Date().toISOString(), status: 'waiting_customer' })
      .eq('id', conversationId);

    // Try to send via the channel API (WhatsApp supports media messages)
    const account = Array.isArray(conv.account) ? conv.account[0] : conv.account;
    const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;

    if (conv.channel === 'whatsapp' && account?.whatsapp_access_token) {
      try {
        const { sendWhatsAppMedia } = await import('@/lib/whatsapp');
        const recipientId = customer?.phone;
        if (recipientId) {
          await sendWhatsAppMedia({
            to: recipientId,
            type,
            mediaUrl,
            caption,
            phoneNumberId: account.whatsapp_phone_number_id,
            accessToken: account.whatsapp_access_token,
          });
        }
      } catch (e) {
        console.warn('[send-media] WhatsApp send failed (message still saved):', e.message);
      }
    }

    return NextResponse.json({ success: true, message, mediaUrl });
  } catch (e) {
    console.error('[send-media] Error:', e);
    return NextResponse.json({ error: 'Failed to send media: ' + e.message }, { status: 500 });
  }
}

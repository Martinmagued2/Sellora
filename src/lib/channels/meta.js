/**
 * Meta Platform Messaging Library
 * Handles sending messages to Instagram DMs and Facebook Messenger
 * via the Meta Graph API v25.0
 */

const META_API_URL = "https://graph.facebook.com/v25.0";

/**
 * Take thread control from secondary receiver or Meta Inbox (Handover Protocol)
 */
export async function takeThreadControl({ recipientId, accessToken }) {
  try {
    const res = await fetch(`${META_API_URL}/me/take_thread_control`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        metadata: "Sellora AI thread control takeover",
      }),
    });
    return await res.json();
  } catch (e) {
    console.warn("takeThreadControl failed:", e.message);
    return null;
  }
}

/**
 * Send a text message to Instagram or Facebook Messenger
 * @param {Object} params
 * @param {string} params.recipientId - IGSID or PSID of the recipient
 * @param {string} params.message - Text message to send
 * @param {string} params.pageId - Facebook/Instagram Page ID
 * @param {string} params.accessToken - Page access token
 */
export async function sendMessage({ recipientId, message, pageId, accessToken }) {
  let response = await fetch(
    `${META_API_URL}/${pageId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: "RESPONSE",
      }),
    }
  );

  let data = await response.json();

  // If send failed due to Handover Protocol (e.g. app does not have thread control)
  if (!response.ok && (data.error?.code === 10 || data.error?.code === 2018028 || data.error?.message?.includes("control"))) {
    console.log(`[META] Handover Protocol triggered for ${recipientId} — attempting to take thread control...`);
    await takeThreadControl({ recipientId, accessToken });
    
    // Retry message send after acquiring control
    response = await fetch(
      `${META_API_URL}/${pageId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
          messaging_type: "RESPONSE",
        }),
      }
    );
    data = await response.json();
  }

  if (!response.ok) {
    console.error("Meta Messaging API error:", data);
    throw new Error(data.error?.message || "Failed to send message");
  }

  return data;
}

/**
 * Send a product card as a generic template message
 * Works on both Instagram and Facebook Messenger
 */
export async function sendProductCard({ recipientId, product, pageId, accessToken }) {
  const elements = [{
    title: product.name,
    subtitle: `${product.price} ${product.currency || 'EGP'}${product.description ? ' — ' + product.description : ''}`,
    image_url: product.image_urls?.[0] || undefined,
    buttons: [
      {
        type: "postback",
        title: "Order Now",
        payload: JSON.stringify({ action: "order", product_id: product.id }),
      },
    ],
  }];

  const response = await fetch(
    `${META_API_URL}/${pageId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements,
            },
          },
        },
        messaging_type: "RESPONSE",
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Meta send product card error:", data);
    throw new Error(data.error?.message || "Failed to send product card");
  }

  return data;
}

/**
 * Get user profile from Meta Graph API
 * Returns name and profile_pic if available
 */
export async function getUserProfile({ userId, accessToken }) {
  try {
    const response = await fetch(
      `${META_API_URL}/${userId}?fields=name,profile_pic`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Parse incoming webhook payload from Instagram
 * Instagram uses the same structure as Messenger but entry object differs
 * Handles batched entries (Meta can send multiple entries per payload)
 */
export function parseInstagramWebhook(body) {
  const results = [];
  const entries = body?.entry || [];

  for (const entry of entries) {
    const messagingEvents = [...(entry?.messaging || []), ...(entry?.standby || [])];
    if (messagingEvents.length === 0) continue;

    for (const event of messagingEvents) {
      const pageId = entry.id;

      // Skip echo messages (messages sent by the page itself)
      if (event.message?.is_echo) continue;

      // Handle text messages
      if (event.message) {
        results.push({
          type: "message",
          senderId: event.sender?.id,
          recipientId: event.recipient?.id,
          pageId,
          timestamp: event.timestamp,
          messageId: event.message.mid,
          text: event.message.text || null,
          attachments: event.message.attachments || [],
          isStoryReply: !!event.message.reply_to?.story,
        });
      }

      // Handle postback (button clicks like "Order Now")
      if (event.postback) {
        results.push({
          type: "postback",
          senderId: event.sender?.id,
          recipientId: event.recipient?.id,
          pageId,
          timestamp: event.timestamp,
          payload: event.postback.payload,
          title: event.postback.title,
        });
      }
    }
  }

  return results.length > 0 ? results : null;
}

/**
 * Parse incoming webhook payload from Facebook Messenger
 * Nearly identical to Instagram but from page subscriptions
 * Handles batched entries (Meta can send multiple entries per payload)
 */
export function parseFacebookWebhook(body) {
  const results = [];
  const entries = body?.entry || [];

  for (const entry of entries) {
    const messagingEvents = [...(entry?.messaging || []), ...(entry?.standby || [])];
    if (messagingEvents.length === 0) continue;

    for (const event of messagingEvents) {
      const pageId = entry.id;

      // Skip echo messages
      if (event.message?.is_echo) continue;

      if (event.message) {
        results.push({
          type: "message",
          senderId: event.sender?.id,
          recipientId: event.recipient?.id,
          pageId,
          timestamp: event.timestamp,
          messageId: event.message.mid,
          text: event.message.text || null,
          attachments: event.message.attachments || [],
        });
      }

      if (event.postback) {
        results.push({
          type: "postback",
          senderId: event.sender?.id,
          recipientId: event.recipient?.id,
          pageId,
          timestamp: event.timestamp,
          payload: event.postback.payload,
          title: event.postback.title,
        });
      }
    }
  }

  return results.length > 0 ? results : null;
}

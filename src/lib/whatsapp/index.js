/**
 * WhatsApp Cloud API v21.0 Integration
 * Handles sending messages, receiving webhooks, and message templates
 */

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

/**
 * Send a text message via WhatsApp
 * Supports both account-level tokens and global env var token
 */
export async function sendWhatsAppMessage({ to, message, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    throw new Error("WhatsApp phone number ID and access token are required");
  }

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: message },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("WhatsApp API error:", data);
    throw new Error(data.error?.message || "Failed to send WhatsApp message");
  }

  return data;
}

/**
 * Send a template message (for initiating conversations)
 */
export async function sendTemplateMessage({
  to,
  templateName,
  languageCode = "en",
  parameters = [],
  phoneNumberId,
  accessToken,
}) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  const components = parameters.length > 0
    ? [
        {
          type: "body",
          parameters: parameters.map((p) => ({
            type: "text",
            text: p,
          })),
        },
      ]
    : undefined;

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to send template message");
  }

  return data;
}

/**
 * Send an interactive product list message
 */
export async function sendProductListMessage({
  to,
  headerText,
  bodyText,
  footerText,
  buttonText,
  sections,
  phoneNumberId,
  accessToken,
}) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: headerText },
          body: { text: bodyText },
          footer: { text: footerText },
          action: {
            button: buttonText,
            sections: sections,
          },
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to send product list");
  }

  return data;
}

/**
 * Send an image message via WhatsApp
 */
export async function sendImageMessage({ to, imageUrl, caption, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "image",
        image: {
          link: imageUrl,
          caption: caption || undefined,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to send image message");
  }

  return data;
}

/**
 * Send a media message (audio or image) via WhatsApp
 * Unified function for the send-media API endpoint.
 */
export async function sendWhatsAppMedia({ to, type, mediaUrl, caption, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  const mediaObject = type === 'audio'
    ? { audio: { link: mediaUrl } }
    : { image: { link: mediaUrl, caption: caption || undefined } };

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: type === 'audio' ? 'audio' : 'image',
        ...mediaObject,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to send media message");
  }

  return data;
}

/**
 * Send a document message via WhatsApp
 */
export async function sendDocumentMessage({ to, documentUrl, filename, caption, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "document",
        document: {
          link: documentUrl,
          filename: filename || undefined,
          caption: caption || undefined,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to send document message");
  }

  return data;
}

/**
 * List WhatsApp Business message templates
 */
export async function listTemplates({ businessAccountId, accessToken }) {
  const wabaId = businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(
    `${WHATSAPP_API_URL}/${wabaId}/message_templates?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to list templates");
  }

  return data.data || [];
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead({ messageId, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

/**
 * Download media (image/audio/video) from WhatsApp by media ID.
 * Returns a Buffer of the media content.
 * The media URL expires after 5 minutes, so download immediately.
 */
export async function downloadWhatsAppMedia({ mediaId, accessToken }) {
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WhatsApp access token required");

  // Step 1: Get the media URL
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const metaData = await metaRes.json();
  if (!metaData.url) throw new Error("Failed to get media URL from WhatsApp");

  // Step 2: Download the actual media
  const mediaRes = await fetch(metaData.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!mediaRes.ok) throw new Error("Failed to download media");

  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  return { buffer, mimeType: metaData.mime_type || "application/octet-stream" };
}

/**
 * Parse incoming webhook payload from WhatsApp
 */
export function parseWebhookMessage(body) {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.[0]) return null;

  const message = value.messages[0];
  const contact = value.contacts?.[0];

  // Extract text + media from any message type
  let text = null;
  let mediaUrl = null;
  let mediaType = null;
  let mediaId = null;

  if (message.type === "text" && message.text?.body) {
    text = message.text.body;
  } else if (message.type === "image" && message.image) {
    mediaType = "image";
    mediaId = message.image.id;
    text = message.image.caption || "📷 Photo";
  } else if (message.type === "audio" && message.audio) {
    mediaType = "audio";
    mediaId = message.audio.id;
    text = "🎤 Voice message";
  } else if (message.type === "video" && message.video) {
    mediaType = "video";
    mediaId = message.video.id;
    text = message.video.caption || "🎬 Video";
  } else if (message.type === "document" && message.document) {
    mediaType = "document";
    mediaId = message.document.id;
    text = message.document.caption || `📄 ${message.document.filename || "Document"}`;
  } else if (message.type === "button" && message.button?.text) {
    text = message.button.text;
  } else if (message.type === "interactive" && message.interactive?.button_reply?.text) {
    text = message.interactive.button_reply.text;
  } else if (message.type === "interactive" && message.interactive?.list_reply?.title) {
    text = message.interactive.list_reply.title;
  }

  return {
    messageId: message.id,
    from: message.from,
    timestamp: message.timestamp,
    type: message.type,
    text,
    mediaUrl,
    mediaType,
    mediaId, // WhatsApp media ID — need to fetch the actual URL via API
    contactName: contact?.profile?.name || null,
    phoneNumberId: value.metadata?.phone_number_id,
  };
}

// ═══════════════════════════════════════════════════════════
// INTERACTIVE MESSAGES (buttons, lists, images with captions)
// ═══════════════════════════════════════════════════════════

/**
 * Send a message with tappable buttons (up to 3).
 * Buttons appear below the message text — customer taps to respond.
 *
 * @param {Object} params
 * @param {string} params.to - recipient phone
 * @param {string} params.body - message text
 * @param {Array} params.buttons - [{ id, title }, ...] (max 3)
 * @param {string} params.phoneNumberId
 * @param {string} params.accessToken
 * @param {string} [params.header] - optional bold header text
 * @param {string} [params.footer] - optional footer text
 */
export async function sendInteractiveButtons({ to, body, buttons, phoneNumberId, accessToken, header, footer }) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) throw new Error("WhatsApp phone number ID and access token are required");

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.title.substring(0, 20) },
        })),
      },
    },
  };
  if (header) payload.interactive.header = { type: "text", text: header };
  if (footer) payload.interactive.footer = { text: footer };

  const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Failed to send interactive buttons");
  return data;
}

/**
 * Send a list message (customer taps to expand a list of options).
 * Good for product catalogs, category selection, etc.
 *
 * @param {Object} params
 * @param {string} params.to
 * @param {string} params.body
 * @param {string} params.buttonText - text on the list button (e.g. "Choose product")
 * @param {Array} params.sections - [{ title, rows: [{ id, title, description }] }]
 * @param {string} params.phoneNumberId
 * @param {string} params.accessToken
 * @param {string} [params.header]
 * @param {string} [params.footer]
 */
export async function sendListMessage({ to, body, buttonText, sections, phoneNumberId, accessToken, header, footer }) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) throw new Error("WhatsApp phone number ID and access token are required");

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonText,
        sections: sections.map(s => ({
          title: s.title,
          rows: s.rows.slice(0, 10).map(r => ({
            id: r.id,
            title: r.title.substring(0, 24),
            description: (r.description || "").substring(0, 72),
          })),
        })),
      },
    },
  };
  if (header) payload.interactive.header = { type: "text", text: header };
  if (footer) payload.interactive.footer = { text: footer };

  const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Failed to send list message");
  return data;
}

/**
 * Set the persistent menu + ice breakers for a WhatsApp phone number.
 * The menu is always visible to customers; ice breakers show when they open the chat.
 *
 * @param {Object} params
 * @param {string} params.phoneNumberId
 * @param {string} params.accessToken
 * @param {Array} params.commands - [{ title, description }] (max 10)
 */
export async function setWhatsAppProfile({ phoneNumberId, accessToken, commands, businessName, businessDescription }) {
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) throw new Error("WhatsApp phone number ID and access token are required");

  const profilePayload = {
    messaging_product: "whatsapp",
    ...(businessName ? { about: businessName.substring(0, 139) } : {}),
    ...(businessDescription ? { description: businessDescription.substring(0, 512) } : {}),
    ...(commands && commands.length > 0 ? {
      vertical: "BUSINESS",
      commands: commands.slice(0, 10).map(c => ({
        title: c.title.substring(0, 25),
        description: (c.description || "").substring(0, 50),
      })),
    } : {}),
  };

  const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/whatsapp_business_profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(profilePayload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Failed to set WhatsApp profile");
  return data;
}

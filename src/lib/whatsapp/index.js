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
 * Parse incoming webhook payload from WhatsApp
 */
export function parseWebhookMessage(body) {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.[0]) return null;

  const message = value.messages[0];
  const contact = value.contacts?.[0];

  return {
    messageId: message.id,
    from: message.from,
    timestamp: message.timestamp,
    type: message.type,
    text: message.text?.body || null,
    contactName: contact?.profile?.name || null,
    phoneNumberId: value.metadata?.phone_number_id,
  };
}

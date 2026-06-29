/**
 * Telegram Bot API integration
 *
 * Setup:
 *   1. User creates a bot via @BotFather on Telegram → gets bot token
 *   2. Sellora stores the token, sets up a webhook
 *   3. Messages from Telegram customers arrive at /api/webhooks/telegram
 *   4. Replies are sent via sendTelegramMessage()
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

export async function setupTelegramWebhook({ botToken, webhookUrl }) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"], drop_pending_updates: true }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Failed to set webhook");
  return data;
}

export async function deleteTelegramWebhook({ botToken }) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/deleteWebhook`, { method: "POST" });
  return res.json();
}

export async function getBotInfo({ botToken }) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getMe`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Invalid bot token");
  return data.result;
}

export async function sendTelegramMessage({ botToken, chatId, text, parseMode = "HTML", replyMarkup = null }) {
  const payload = { chat_id: chatId, text: text.slice(0, 4096), parse_mode: parseMode };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Failed to send message");
  return data;
}

/**
 * Send a message with inline keyboard buttons.
 * @param {Object} params
 * @param {string} params.botToken
 * @param {string|number} params.chatId
 * @param {string} params.text - Message text
 * @param {Array<Array<{text: string, callback_data: string}>>} params.buttons - 2D array of button rows
 * @param {string} [params.parseMode]
 */
export async function sendTelegramMessageWithButtons({ botToken, chatId, text, buttons, parseMode = "HTML" }) {
  return sendTelegramMessage({
    botToken, chatId, text, parseMode,
    replyMarkup: { inline_keyboard: buttons },
  });
}

/**
 * Answer a callback query (removes the loading spinner on the button).
 */
export async function answerCallbackQuery({ botToken, callbackQueryId, text }) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || undefined }),
  });
  return res.json();
}

/**
 * Helper: build payment method buttons.
 */
export function paymentMethodButtons() {
  return [
    [
      { text: "💵 Cash on Delivery", callback_data: "pay_cod" },
      { text: "📱 Vodafone Cash", callback_data: "pay_vodafone_cash" },
    ],
    [
      { text: "🏦 InstaPay", callback_data: "pay_instapay" },
    ],
  ];
}

/**
 * Helper: build Yes/No confirmation buttons.
 */
export function confirmButtons() {
  return [
    [
      { text: "✅ Yes, confirm", callback_data: "confirm_yes" },
      { text: "❌ No, cancel", callback_data: "confirm_no" },
    ],
  ];
}

/**
 * Helper: build product variant buttons.
 * @param {Array<{name: string, id: string}>} variants
 */
export function variantButtons(variants) {
  return variants.map(v => [{ text: v.name, callback_data: `variant_${v.id}` }]);
}

export async function sendTelegramPhoto({ botToken, chatId, photoUrl, caption }) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption ? caption.slice(0, 1024) : undefined }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Failed to send photo");
  return data;
}

export async function sendTelegramAudio({ botToken, chatId, audioUrl, caption }) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendAudio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, audio: audioUrl, caption: caption ? caption.slice(0, 1024) : undefined }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Failed to send audio");
  return data;
}

export function parseTelegramUpdate(body) {
  // Handle callback queries (button presses)
  if (body?.callback_query) {
    const cq = body.callback_query;
    const message = cq.message;
    return {
      messageId: String(message?.message_id || Date.now()),
      from: String(cq.message?.chat?.id || cq.from?.id),
      fromName: cq.from?.username || cq.from?.first_name || "Unknown",
      text: cq.data || null, // The callback_data from the button
      mediaUrl: null, mediaType: null, mediaId: null,
      chatId: cq.message?.chat?.id,
      phoneNumberId: null,
      timestamp: new Date().toISOString(),
      isCallback: true,
      callbackQueryId: cq.id,
    };
  }

  if (!body?.message) return null;
  const message = body.message;
  const from = message.from;
  const chatId = message.chat?.id;
  const text = message.text || message.caption || null;

  let mediaUrl = null, mediaType = null;
  if (message.photo) {
    mediaType = "image";
    mediaUrl = message.photo[message.photo.length - 1]?.file_id;
  } else if (message.voice || message.audio) {
    mediaType = "audio";
    mediaUrl = (message.voice || message.audio)?.file_id;
  } else if (message.video) {
    mediaType = "video";
    mediaUrl = message.video.file_id;
  }

  return {
    messageId: String(message.message_id),
    from: String(chatId),
    fromName: from?.username || from?.first_name || "Unknown",
    text: text || (mediaType ? `Sent a ${mediaType}` : null),
    mediaUrl, mediaType, mediaId: mediaUrl,
    chatId,
    phoneNumberId: null,
    timestamp: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
  };
}

export async function downloadTelegramFile({ botToken, fileId }) {
  const metaRes = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getFile`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  const metaData = await metaRes.json();
  if (!metaData.ok) throw new Error("Failed to get file from Telegram");
  const fileUrl = `${TELEGRAM_API_BASE}/file/bot${botToken}/${metaData.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error("Failed to download file");
  return { buffer: Buffer.from(await fileRes.arrayBuffer()), mimeType: fileRes.headers.get("content-type") || "application/octet-stream" };
}

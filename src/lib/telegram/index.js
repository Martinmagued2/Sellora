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
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"], drop_pending_updates: true }),
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

export async function sendTelegramMessage({ botToken, chatId, text, parseMode = "HTML" }) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096), parse_mode: parseMode }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Failed to send message");
  return data;
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

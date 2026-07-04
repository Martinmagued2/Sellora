/**
 * AI Reply Helpers
 *
 * Centralizes:
 *  - AI pause check (per-conversation "Pause AI" toggle)
 *  - Typing indicator (WhatsApp + Meta)
 *  - Reply throttle (1.5–3s) for human-feeling latency
 *  - AI failure → auto-escalation to human queue
 *  - AI deflection tracking (resolved_by field on conversations)
 *
 * Used by src/lib/channels/processor.js
 */

import { createClient } from "@supabase/supabase-js";

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

/**
 * Check whether AI replies are paused for a conversation.
 * A pause can be:
 *  - indefinite (ai_paused=TRUE, ai_paused_until=NULL)
 *  - time-bounded (ai_paused=TRUE, ai_paused_until=<future timestamp>)
 *
 * If ai_paused_until is in the past, automatically clears the pause.
 *
 * @param {string} conversationId
 * @returns {Promise<{paused: boolean, reason?: string}>}
 */
export async function isAiPaused(conversationId) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("conversations")
      .select("ai_paused, ai_paused_until, escalation_reason")
      .eq("id", conversationId)
      .single();

    if (error || !data) return { paused: false };

    if (!data.ai_paused) return { paused: false };

    // Time-bounded pause that has expired → auto-clear
    if (data.ai_paused_until) {
      const until = new Date(data.ai_paused_until).getTime();
      if (Date.now() > until) {
        await supabase
          .from("conversations")
          .update({
            ai_paused: false,
            ai_paused_until: null,
            escalation_reason: null,
          })
          .eq("id", conversationId);
        return { paused: false };
      }
    }

    return {
      paused: true,
      reason: data.escalation_reason || "AI paused by operator",
    };
  } catch (err) {
    console.warn("[AI-HELPERS] isAiPaused failed:", err.message);
    return { paused: false };
  }
}

/**
 * Show a typing indicator on the customer's channel.
 * WhatsApp Cloud API supports a "typing" indicator; Meta Messenger supports "typing_on".
 * Best-effort: failures are swallowed.
 *
 * @param {Object} params
 * @param {string} params.channel - 'whatsapp' | 'instagram' | 'facebook'
 * @param {string} params.recipientId - customer's platform ID
 * @param {string} [params.phoneNumberId] - for WhatsApp
 * @param {string} [params.accessToken] - page access token (IG/FB) or WhatsApp token
 * @param {string} [params.pageId] - for IG/FB
 */
export async function showTypingIndicator({
  channel,
  recipientId,
  phoneNumberId,
  accessToken,
  pageId,
}) {
  try {
    if (!accessToken) return;

    if (channel === "whatsapp" && phoneNumberId) {
      // WhatsApp Cloud API: typing indicator via status endpoint
      // https://developers.facebook.com/docs/whatsapp/cloud-api/guides/mark-messages-as-read
      await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipientId,
            type: "reaction", // WhatsApp doesn't have native typing — we use a brief presence
            // Note: WhatsApp Cloud API doesn't expose typing indicator directly.
            // We skip silently — the throttle below still adds latency.
          }),
        }
      ).catch(() => {}); // swallow — typing is best-effort
    } else if ((channel === "instagram" || channel === "facebook") && pageId) {
      // Meta Messenger: sender_action typing_on
      await fetch(
        `https://graph.facebook.com/v20.0/${pageId}/messages?recipient={id:"${recipientId}"}&sender_action=typing_on&messaging_type=RESPONSE&access_token=${accessToken}`,
        { method: "POST" }
      ).catch(() => {});
    }
  } catch (err) {
    // Typing indicator is purely cosmetic — never fail the reply on it
    console.debug("[AI-HELPERS] typing indicator failed:", err.message);
  }
}

/**
 * Throttle the AI reply by a randomized human-feeling delay.
 * - Short messages: 1.0–2.0s
 * - Medium messages: 1.5–3.0s
 * - Long messages: 2.0–4.0s
 *
 * @param {string} replyText - the AI reply that will be sent
 * @returns {Promise<void>}
 */
export function humanReplyDelay(replyText = "") {
  const len = replyText.length;
  let min, max;
  if (len < 50) {
    min = 1000;
    max = 2000;
  } else if (len < 200) {
    min = 1500;
    max = 3000;
  } else {
    min = 2000;
    max = 4000;
  }
  const delay = Math.floor(Math.random() * (max - min)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Mark a conversation as escalated to the human queue.
 * Sets ai_paused=TRUE with a 4-hour auto-resume and records the reason.
 *
 * @param {string} conversationId
 * @param {string} reason - why the escalation happened
 * @param {string} [accountId]
 */
export async function escalateToHuman(conversationId, reason, accountId = null) {
  try {
    const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const supabase = getSupabase();

    await supabase
      .from("conversations")
      .update({
        ai_paused: true,
        ai_paused_until: fourHoursFromNow,
        escalation_reason: reason,
        status: "needs_attention",
      })
      .eq("id", conversationId);

    // Record the event
    if (accountId) {
      await supabase.from("conversation_events").insert({
        conversation_id: conversationId,
        account_id: accountId,
        event_type: "escalated",
        metadata: { reason, auto_resume_at: fourHoursFromNow },
      });
    }

    console.log(
      `[AI-HELPERS] Conversation ${conversationId} escalated to human: ${reason}`
    );
  } catch (err) {
    console.warn("[AI-HELPERS] escalateToHuman failed:", err.message);
  }
}

/**
 * Track deflection: when an AI message is sent, mark the conversation
 * as "ai" (or "mixed" if a human has also replied). When a human replies,
 * update to "human" or "mixed".
 *
 * @param {string} conversationId
 * @param {"ai" | "human"} sender - who just sent a message
 */
export async function trackDeflection(conversationId, sender) {
  try {
    const supabase = getSupabase();
    const { data: conv } = await supabase
      .from("conversations")
      .select("resolved_by, first_ai_reply_at, first_human_reply_at")
      .eq("id", conversationId)
      .single();

    if (!conv) return;

    const now = new Date().toISOString();
    const updates = {};

    if (sender === "ai" && !conv.first_ai_reply_at) {
      updates.first_ai_reply_at = now;
    }
    if (sender === "human" && !conv.first_human_reply_at) {
      updates.first_human_reply_at = now;
    }

    // Update resolved_by only if not already set
    if (!conv.resolved_by) {
      // Don't set resolved_by yet — wait for the conversation to be closed
      // We just track first-reply times here
    } else if (conv.resolved_by === "ai" && sender === "human") {
      // Was AI-resolved but a human jumped in → mark as mixed
      updates.resolved_by = "mixed";
    } else if (conv.resolved_by === "human" && sender === "ai") {
      updates.resolved_by = "mixed";
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("conversations").update(updates).eq("id", conversationId);
    }
  } catch (err) {
    console.debug("[AI-HELPERS] trackDeflection failed:", err.message);
  }
}

/**
 * When a conversation is closed, compute its final resolved_by status
 * based on who replied. Call this from the conversations close API.
 *
 * @param {string} conversationId
 */
export async function finalizeDeflection(conversationId) {
  try {
    const supabase = getSupabase();
    const { data: conv } = await supabase
      .from("conversations")
      .select("first_ai_reply_at, first_human_reply_at, resolved_by")
      .eq("id", conversationId)
      .single();

    if (!conv) return;

    let resolvedBy = null;
    if (conv.first_ai_reply_at && !conv.first_human_reply_at) {
      resolvedBy = "ai";
    } else if (!conv.first_ai_reply_at && conv.first_human_reply_at) {
      resolvedBy = "human";
    } else if (conv.first_ai_reply_at && conv.first_human_reply_at) {
      resolvedBy = "mixed";
    }

    await supabase
      .from("conversations")
      .update({ resolved_by: resolvedBy })
      .eq("id", conversationId);
  } catch (err) {
    console.debug("[AI-HELPERS] finalizeDeflection failed:", err.message);
  }
}

/**
 * Send a fallback "human will help" message when all AI providers fail.
 *
 * @param {Object} params
 * @param {string} params.channel
 * @param {string} params.recipientId
 * @param {string} [params.phoneNumberId]
 * @param {string} [params.accessToken]
 * @param {string} [params.pageId]
 * @param {string} [params.businessName]
 */
export async function sendAiFailureFallback({
  channel,
  recipientId,
  phoneNumberId,
  accessToken,
  pageId,
  businessName = "us",
}) {
  const message = `Hi! I'm having trouble responding right now, but our team has been notified and a human will reach out to you shortly. Thanks for your patience! 🙏`;

  try {
    if (channel === "whatsapp") {
      const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
      await sendWhatsAppMessage({
        to: recipientId,
        message,
        phoneNumberId,
        accessToken,
      });
    } else {
      const { sendMessage } = await import("@/lib/channels/meta");
      await sendMessage({
        recipientId,
        message,
        pageId,
        accessToken,
      });
    }
  } catch (err) {
    console.error("[AI-HELPERS] Failed to send AI failure fallback:", err.message);
  }
}

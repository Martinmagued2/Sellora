/**
 * Shared Channel Message Processor
 * 
 * This is the core pipeline that ALL channels (IG, FB, WhatsApp) use.
 * It handles: Customer upsert → Conversation upsert → Message storage → AI reply
 * 
 * By centralizing this, we guarantee consistent behavior across channels.
 */

import { createClient } from "@supabase/supabase-js";
import { generateAIReply, generateAIReplyWithVision, analyzeIntent } from "@/lib/ai";
import { sendMessage } from "@/lib/channels/meta";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendTelegramMessage } from "@/lib/telegram";
import { getPlanLimits } from "@/lib/plan-limits";
import { dispatchWebhook } from "@/lib/webhooks";
import {
  isAiPaused,
  showTypingIndicator,
  humanReplyDelay,
  escalateToHuman,
  trackDeflection,
  sendAiFailureFallback,
} from "@/lib/ai/reply-helpers";

// Service role client for server-side processing (lazy-initialized)
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
 * Resolve the access token for a channel when it wasn't passed by the webhook handler.
 * This is crucial for delivering AI replies — without a valid token, replies are stored
 * but never delivered to the customer's Instagram/Facebook/WhatsApp inbox.
 *
 * @param {string} accountId - The account ID to look up
 * @param {string} channel - 'instagram' | 'facebook' | 'whatsapp'
 * @returns {Promise<{accessToken: string|null, pageId: string|null}>}
 */
async function resolveChannelToken(accountId, channel) {
  if (channel === "whatsapp") {
    const { data } = await getSupabase()
      .from("accounts")
      .select("whatsapp_access_token, whatsapp_phone_number_id, whatsapp_connected")
      .eq("id", accountId)
      .single();
    if (data?.whatsapp_connected && data?.whatsapp_access_token) {
      return { accessToken: data.whatsapp_access_token, pageId: data.whatsapp_phone_number_id };
    }
    return { accessToken: null, pageId: null };
  }
  const tokenColumn = channel === "instagram" ? "instagram_access_token" : "facebook_access_token";
  const pageIdColumn = channel === "instagram" ? "instagram_page_id" : "facebook_page_id";
  const { data } = await getSupabase()
    .from("accounts")
    .select(`${tokenColumn}, ${pageIdColumn}`)
    .eq("id", accountId)
    .single();
  return {
    accessToken: data?.[tokenColumn] || null,
    pageId: data?.[pageIdColumn] || null,
  };
}

/**
 * Unified reply sender — handles all 5 channels.
 * @param {Object} params
 * @param {string} params.channel - whatsapp|instagram|facebook|telegram|email
 * @param {string} params.senderId - recipient ID (phone/chatId/platformId/email)
 * @param {string} params.message - text to send
 * @param {Object} params.account - full account row
 * @param {string} [params.accessToken] - optional pre-resolved token
 * @param {string} [params.pageId] - optional pre-resolved page ID
 * @returns {Promise<boolean>} true if delivered
 */
async function sendChannelReply({ channel, senderId, message, account, accessToken, pageId }) {
  try {
    if (channel === "whatsapp") {
      const waToken = account.whatsapp_access_token || accessToken;
      const waPhoneId = account.whatsapp_phone_number_id || pageId;
      if (!waToken || !waPhoneId) return false;
      await sendWhatsAppMessage({ to: senderId, message, phoneNumberId: waPhoneId, accessToken: waToken });
      return true;
    }
    if (channel === "telegram") {
      const botToken = account.telegram_bot_token || accessToken;
      if (!botToken) return false;
      await sendTelegramMessage({ botToken, chatId: senderId, text: message });
      return true;
    }
    if (channel === "email") {
      // Use Resend to send email reply
      const { sendCustomEmail, isEmailConfigured } = await import("@/lib/email");
      if (!isEmailConfigured()) return false;
      await sendCustomEmail({
        to: senderId, // email address
        subject: "Re: Your message",
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p style="font-size: 15px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${message}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 12px; color: #9ca3af;">Sent from Sellora</p>
        </div>`,
      });
      return true;
    }
    // Instagram + Facebook (Meta)
    let metaToken = accessToken;
    let metaPageId = pageId;
    if (!metaToken) {
      const resolved = await resolveChannelToken(account.id, channel);
      metaToken = resolved.accessToken;
      metaPageId = resolved.pageId || pageId;
    }
    if (metaToken && metaPageId) {
      await sendMessage({ recipientId: senderId, message, pageId: metaPageId, accessToken: metaToken });
      return true;
    }
    return false;
  } catch (e) {
    console.warn(`[PROCESSOR] Failed to send ${channel} reply:`, e.message);
    return false;
  }
}

/**
 * Process an incoming message from any channel
 * 
 * @param {Object} params
 * @param {string} params.senderId - Platform user ID (IGSID, PSID)
 * @param {string} params.senderName - Display name (if available from profile)
 * @param {string} params.senderProfilePic - Profile picture URL
 * @param {string} params.text - Message text content
 * @param {string[]} params.mediaUrls - Attachment URLs
 * @param {string} params.channel - 'instagram' | 'facebook' | 'whatsapp'
 * @param {string} params.pageId - The business's page ID that received the message
 * @param {string} params.platformMessageId - Original message ID from the platform
 * @param {string} params.accessToken - Page access token for replies
 */
export async function processIncomingMessage({
  senderId,
  senderName,
  senderProfilePic,
  text,
  mediaUrls = [],
  mediaType = null,
  channel,
  pageId,
  platformMessageId,
  accessToken,
  accountId: providedAccountId, // Optional: passed by webhook handler to resolve duplicate page_ids
}) {
  try {
    // ─── 1. Find the account that owns this page ───
    const pageColumn = channel === "instagram" ? "instagram_page_id" : channel === "whatsapp" ? "whatsapp_phone_number_id" : channel === "telegram" ? "telegram_bot_token" : channel === "email" ? "email_inbound_address" : "facebook_page_id";

    // Step 1a: Fetch core columns that MUST exist
    // If accountId was provided (from webhook handler that already resolved duplicates), use it directly
    let account;
    if (providedAccountId) {
      const { data: directAccount, error: directError } = await getSupabase()
        .from("accounts")
        .select("id, ai_enabled, ai_personality, plan, business_name, country, whatsapp_phone_number_id, whatsapp_access_token, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id, telegram_bot_token, telegram_connected, email_channel_enabled, email_inbound_address, notify_escalations, auto_greeting, auto_greeting_message, greeting_per_channel, instagram_greeting, facebook_greeting, whatsapp_greeting, greeting_delay_seconds, ai_escalation_keywords, notify_escalations, auto_follow_up_enabled")
        .eq("id", providedAccountId)
        .maybeSingle();

      if (directError || !directAccount) {
        console.error(`[PROCESSOR] Account lookup by ID failed for ${providedAccountId}:`, directError?.message);
        return;
      }
      account = directAccount;
    } else {
      // No accountId provided — look up by page ID (handle duplicates gracefully)
      const { data: accounts, error: accountError } = await getSupabase()
        .from("accounts")
        .select("id, ai_enabled, ai_personality, plan, business_name, country, whatsapp_phone_number_id, whatsapp_access_token, instagram_access_token, instagram_page_id, facebook_access_token, facebook_page_id, telegram_bot_token, telegram_connected, email_channel_enabled, email_inbound_address, notify_escalations, auto_greeting, auto_greeting_message, greeting_per_channel, instagram_greeting, facebook_greeting, whatsapp_greeting, greeting_delay_seconds, ai_escalation_keywords, notify_escalations, auto_follow_up_enabled")
        .eq(pageColumn, pageId);

      if (accountError || !accounts || accounts.length === 0) {
        console.error(`[PROCESSOR] No account found for ${channel} page ${pageId}. Error: ${accountError?.message || "null result"}`);
        console.error(`[PROCESSOR] HINT: Check that ${pageColumn}="${pageId}" exists in the accounts table`);
        return;
      }

      if (accounts.length > 1) {
        console.warn(`[PROCESSOR] Multiple accounts (${accounts.length}) share ${pageColumn}=${pageId}. Picking the one with a valid access token.`);
      }

      // Prefer the account that has a valid access token for this channel
      account = (() => {
        if (channel === 'whatsapp') return accounts.find(a => a.whatsapp_access_token) || accounts[0];
        // For instagram/facebook, the token comes from the webhook handler, not from account lookup
        // So just pick the first one (they should all have the same page_id)
        return accounts[0];
      })();
    }

    // Step 1b: Try to fetch optional columns (greeting features may not be migrated yet)
    // These are optional and should not break the pipeline if missing
    try {
      const { data: optionalData } = await getSupabase()
        .from("accounts")
        .select("auto_greeting, auto_greeting_message, greeting_per_channel, greeting_delay_seconds, instagram_greeting, facebook_greeting, whatsapp_greeting")
        .eq("id", account.id)
        .single();
      if (optionalData) {
        Object.assign(account, optionalData);
      }
    } catch (optErr) {
      // Optional columns don't exist yet — use defaults
      console.log(`[PROCESSOR] Greeting columns not yet migrated, using defaults`);
      account.auto_greeting = false;
      account.auto_greeting_message = null;
      account.greeting_per_channel = false;
      account.greeting_delay_seconds = 0;
      account.instagram_greeting = null;
      account.facebook_greeting = null;
      account.whatsapp_greeting = null;
    }

    // ─── 2. Find or create customer ───
    let { data: customer } = await getSupabase()
      .from("customers")
      .select("*")
      .eq("account_id", account.id)
      .eq("platform_id", senderId)
      .maybeSingle();

    const isNewCustomer = !customer;

    if (!customer) {
      const { data: newCustomer, error: custInsertErr } = await getSupabase()
        .from("customers")
        .insert({
          account_id: account.id,
          name: senderName || "Unknown",
          platform_id: senderId,
          platform: channel,
          channel: channel,
          phone: channel === "whatsapp" ? senderId : null,
          profile_pic_url: senderProfilePic || null,
          first_seen_at: new Date().toISOString(),
          is_returning: false,
        })
        .select()
        .maybeSingle();

      if (custInsertErr || !newCustomer) {
        console.error(`[PROCESSOR] Failed to create customer for ${channel} ${senderId}:`, custInsertErr?.message);
        return;
      }
      customer = newCustomer;
    } else {
      // Update profile pic and name if we have newer data
      const updates = {};
      if (senderName && senderName !== "Unknown" && customer.name === "Unknown") {
        updates.name = senderName;
      }
      if (senderProfilePic && !customer.profile_pic_url) {
        updates.profile_pic_url = senderProfilePic;
      }
      if (Object.keys(updates).length > 0) {
        updates.last_active_at = new Date().toISOString();
        await getSupabase().from("customers").update(updates).eq("id", customer.id);
      }
    }

    // ─── 3. Find or create conversation ───
    let { data: conversation } = await getSupabase()
      .from("conversations")
      .select("*")
      .eq("account_id", account.id)
      .eq("customer_id", customer.id)
      .eq("channel", channel)
      .in("status", ["new", "open", "in_progress", "waiting_customer"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv, error: convInsertErr } = await getSupabase()
        .from("conversations")
        .insert({
          account_id: account.id,
          customer_id: customer.id,
          channel: channel,
          status: "new",
          platform_thread_id: senderId,
        })
        .select()
        .maybeSingle();

      if (convInsertErr || !newConv) {
        console.error(`[PROCESSOR] Failed to create conversation:`, convInsertErr?.message);
        return;
      }
      conversation = newConv;
    }

    // ─── 4. Detect intent and sentiment ───
    let intent = null;
    let sentiment = null;
    if (text) {
      try {
        const intentResult = await analyzeIntent(text);
        intent = intentResult?.intent || null;
        sentiment = intentResult?.sentiment || null;
      } catch (e) {
        console.warn("Intent detection failed:", e.message);
      }
    }

    // ─── 5. Store the incoming message ───
    // 🔧 FIX: use mediaType from webhook (image/audio/video) instead of always "image"
    const messageType = mediaUrls.length > 0 ? (mediaType || "image") : "text";
    const { error: insertError } = await getSupabase().from("messages").insert({
      conversation_id: conversation.id,
      account_id: account.id,
      direction: "incoming",
      content: text,
      type: messageType,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      media_url: mediaUrls.length > 0 ? mediaUrls[0] : null,
      media_type: mediaType || null,
      platform_message_id: platformMessageId,
      intent: intent,
      sentiment: sentiment,
      is_ai: false,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        console.log(`[PROCESSOR] Replay detected for message ${platformMessageId}. Ignoring.`);
        return; // Return early to prevent AI processing
      }
      console.error("Failed to insert incoming message:", insertError);
      throw insertError;
    }

    // ─── 5.5 Dispatch Webhook (Plan check happens inside webhooks.js, but we do a quick check here too) ───
    const limits = getPlanLimits(account.plan || "starter");
    if (limits.webhooks) {
      // Don't await the webhook to avoid blocking the main thread response
      dispatchWebhook(account.id, "message.received", {
        conversationId: conversation.id,
        direction: "incoming",
        content: text,
        type: messageType,
        mediaUrls,
        platformMessageId,
        intent,
        channel
      }).catch(err => console.error("Webhook dispatch failed:", err));
    }

    // ─── 5.6 Fire push notification + DB notification to the merchant ───
    // Best-effort: failures are swallowed so they never block the AI pipeline
    (async () => {
      try {
        // Insert a notification row (powers the bell icon dropdown)
        await getSupabase().from("notifications").insert({
          account_id: account.id,
          type: "new_message",
          title: `New message from ${customer.name || "a customer"}`,
          body: text ? text.substring(0, 100) : (mediaUrls.length > 0 ? "📷 Sent an image" : "New message"),
          link: "/dashboard/conversations",
          metadata: {
            conversation_id: conversation.id,
            customer_id: customer.id,
            channel,
            intent,
          },
        });

        // Fire a web push notification to all subscribed devices
        const { broadcastPushToAccount } = await import("@/lib/push/web-push");
        await broadcastPushToAccount(getSupabase(), account.id, {
          title: `💬 ${customer.name || "New message"}`,
          body: text ? text.substring(0, 80) : "Sent an image",
          url: "/dashboard/conversations",
          tag: `conv-${conversation.id}`,
          data: { conversationId: conversation.id },
        });
      } catch (pushErr) {
        // Silent fail — push is best-effort
        console.warn("[PROCESSOR] Push notification failed:", pushErr.message);
      }
    })();

    // ─── 6. Update conversation metadata ───
    const convUpdates = {
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
    };
    
    // If status is "waiting_customer", move back to "in_progress"
    if (conversation.status === "waiting_customer") {
      convUpdates.status = "in_progress";
    }

    await getSupabase()
      .from("conversations")
      .update(convUpdates)
      .eq("id", conversation.id);

    // ─── 7. Auto-tag conversation based on intent and sentiment ───
    if (intent && intent !== "general") {
      const currentTags = conversation.tags || [];
      const intentTag = `intent:${intent}`;
      if (!currentTags.includes(intentTag)) {
        await getSupabase()
          .from("conversations")
          .update({ tags: [...currentTags, intentTag] })
          .eq("id", conversation.id);
      }
    }

    // Auto-tag and escalate conversations with negative/urgent sentiment
    if (sentiment && (sentiment === "negative" || sentiment === "urgent")) {
      const currentTags = conversation.tags || [];
      const sentimentTag = `sentiment:${sentiment}`;
      const updateData = {};
      if (!currentTags.includes(sentimentTag)) {
        updateData.tags = [...currentTags, sentimentTag];
      }
      // Auto-escalate urgent conversations to in_progress if they're new
      if (sentiment === "urgent" && (conversation.status === "new" || conversation.status === "waiting_customer")) {
        updateData.status = "in_progress";
      }
      if (Object.keys(updateData).length > 0) {
        await getSupabase()
          .from("conversations")
          .update(updateData)
          .eq("id", conversation.id);
      }
    }

    // ─── 8. Auto-Greeting for new customers (BEFORE FAQ/keyword/AI) ───
    if (account.auto_greeting && isNewCustomer && text) {
      try {
        // Determine greeting message based on channel
        let greetingMessage;
        if (account.greeting_per_channel) {
          // Use channel-specific greeting
          const channelGreetings = {
            instagram: account.instagram_greeting,
            facebook: account.facebook_greeting,
            whatsapp: account.whatsapp_greeting,
          };
          greetingMessage = channelGreetings[channel] || account.auto_greeting_message || "Hi! Welcome to {business_name} 👋 How can I help you today?";
        } else {
          greetingMessage = account.auto_greeting_message || "Hi! Welcome to {business_name} 👋 How can I help you today?";
        }

        greetingMessage = greetingMessage
          .replace(/\{business_name\}/g, account.business_name || "our store")
          .replace(/\{name\}/g, customer.name || "there");

        // Apply greeting delay if configured
        const delaySeconds = account.greeting_delay_seconds || 0;
        if (delaySeconds > 0) {
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }

        // Send greeting via the appropriate channel (best-effort)
        let greetingDelivered = false;
        try {
          greetingDelivered = await sendChannelReply({
            channel, senderId, message: greetingMessage, account, accessToken, pageId,
          });
          if (!greetingDelivered) {
            console.warn(`[PROCESSOR] No ${channel} token for greeting delivery — greeting stored but NOT sent`);
          }
        } catch (deliveryErr) {
          console.warn(`[PROCESSOR] Greeting delivery failed for ${channel}:`, deliveryErr.message);
        }

        // Store the greeting message (always, even if delivery failed)
        try {
          await getSupabase().from("messages").insert({
            conversation_id: conversation.id,
            account_id: account.id,
            direction: "outgoing",
            content: greetingMessage,
            type: "text",
            is_ai: false,
            delivery_status: greetingDelivered ? "delivered" : "failed",
          });
        } catch (dbErr) {
          console.warn(`[PROCESSOR] Failed to store greeting in database:`, dbErr.message);
        }

        // Track first response time
        if (!conversation.first_response_at) {
          await getSupabase()
            .from("conversations")
            .update({ first_response_at: new Date().toISOString() })
            .eq("id", conversation.id);
        }
      } catch (greetingErr) {
        // Greeting failure should not block the pipeline
        console.warn("Auto-greeting failed:", greetingErr.message);
      }
    }

    // ─── 9. Check FAQ auto-replies first, then keyword auto-replies ───
    let faqMatchedAndReplied = false; // Track if FAQ already replied so AI doesn't duplicate
    if (text) {
      // ─── 9a. Check FAQ knowledge base ───
      try {
        const { data: faqs } = await getSupabase()
          .from("faqs")
          .select("id, question, answer, category")
          .eq("account_id", account.id)
          .eq("is_active", true);

        if (faqs && faqs.length > 0) {
          const lowerText = text.toLowerCase();
          const searchTerms = lowerText.split(/\s+/).filter(Boolean);

          // Common stop words that cause false FAQ matches.
          // These words appear in many FAQ questions/answers and should NOT
          // contribute to scoring because they match almost any FAQ.
          const STOP_WORDS = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
            'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'this',
            'that', 'with', 'they', 'will', 'what', 'when', 'how', 'why',
            'who', 'from', 'your', 'been', 'does', 'just', 'want', 'like',
            'know', 'need', 'some', 'more', 'also', 'very', 'much', 'tell',
            'about', 'could', 'would', 'should', 'there', 'their', 'where',
            'which', 'hello', 'please', 'thank', 'thanks', 'hi', 'hey',
          ]);

          const scored = faqs.map((faq) => {
            let score = 0;
            let matchCount = 0; // Track how many unique terms actually matched
            const qLower = (faq.question || "").toLowerCase();
            const aLower = (faq.answer || "").toLowerCase();
            const cLower = (faq.category || "").toLowerCase();

            for (const term of searchTerms) {
              // Skip very short words (1-2 chars) and common stop words
              if (term.length <= 2) continue;
              if (STOP_WORDS.has(term)) continue;

              let termMatched = false;
              if (qLower.includes(term)) { score += 10; termMatched = true; }
              if (cLower.includes(term)) { score += 8; termMatched = true; }
              if (aLower.includes(term)) { score += 5; termMatched = true; }
              if (termMatched) matchCount++;
            }

            // Bonus: exact question match gets a big boost (very high confidence)
            if (qLower === lowerText) score += 50;
            // Near-exact match: the FAQ question is a substring of the customer message,
            // or vice versa — but ONLY if the shorter one is at least 4 chars to avoid
            // trivial matches like "hi" matching "Hi, how are you?"
            const shorter = qLower.length < lowerText.length ? qLower : lowerText;
            if (shorter.length >= 4) {
              if (qLower.includes(lowerText) || lowerText.includes(qLower)) score += 20;
            }

            // Require at least 2 meaningful terms to match, otherwise it's likely a
            // false positive from a single common word hitting a FAQ
            if (matchCount < 2) score = Math.min(score, 15); // Cap score if only 1 term matched

            return { ...faq, score };
          });

          const bestMatch = scored
            .filter((f) => f.score > 0)
            .sort((a, b) => b.score - a.score)[0];

          // Use FAQ auto-reply ONLY for high-confidence matches (score >= 30).
          // Scores 20-29 are often false positives from common words matching
          // FAQ content — in those cases, let AI handle it instead.
          // Raised from 20 to 30 to reduce false positives that were blocking AI replies.
          if (bestMatch && bestMatch.score >= 30) {
            // Send the FAQ answer via the appropriate channel (best-effort)
            let faqDelivered = false;
            try {
              faqDelivered = await sendChannelReply({
                channel, senderId, message: bestMatch.answer, account, accessToken, pageId,
              });
            } catch (deliveryErr) {
              console.warn(`[PROCESSOR] FAQ reply delivery failed for ${channel}:`, deliveryErr.message);
            }

            // Store it (always, even if delivery failed)
            try {
              await getSupabase().from("messages").insert({
                conversation_id: conversation.id,
                account_id: account.id,
                direction: "outgoing",
                content: bestMatch.answer,
                type: "text",
                is_ai: true,
                delivery_status: faqDelivered ? "delivered" : "failed",
              });
            } catch (dbErr) {
              console.warn(`[PROCESSOR] Failed to store FAQ reply:`, dbErr.message);
            }

            // Track first response time
            if (!conversation.first_response_at) {
              await getSupabase()
                .from("conversations")
                .update({ first_response_at: new Date().toISOString() })
                .eq("id", conversation.id);
            }

            // FAQ reply handled, skip keyword and AI — but ONLY if delivery succeeded.
            // If delivery failed, fall through to AI so the customer still gets a reply.
            if (faqDelivered) {
              faqMatchedAndReplied = true;
              return;
            } else {
              console.log(`[PROCESSOR] FAQ matched but delivery failed — falling through to AI reply`);
              faqMatchedAndReplied = false; // Let AI handle it instead
            }
          }
        }
      } catch (faqErr) {
        // FAQ check failure should not block the pipeline
        console.warn("FAQ auto-reply check failed:", faqErr.message);
      }

      // ─── 9b. Check keyword auto-replies ───
      const { data: autoReplies } = await getSupabase()
        .from("auto_replies")
        .select("*")
        .eq("account_id", account.id)
        .eq("is_active", true);

      if (autoReplies && autoReplies.length > 0) {
        const lowerText = text.toLowerCase();
        const matchedReply = autoReplies.find((ar) => {
          const keyword = ar.trigger_keyword.toLowerCase();
          if (ar.match_type === "exact") return lowerText === keyword;
          if (ar.match_type === "starts_with") return lowerText.startsWith(keyword);
          return lowerText.includes(keyword); // contains
        });

        if (matchedReply) {
          // Send the auto-reply via the appropriate channel (best-effort)
          let keywordDelivered = false;
          try {
            keywordDelivered = await sendChannelReply({
              channel, senderId, message: matchedReply.response, account, accessToken, pageId,
            });
          } catch (deliveryErr) {
            console.warn(`[PROCESSOR] Keyword reply delivery failed for ${channel}:`, deliveryErr.message);
          }

          // Store it (always, even if delivery failed)
          try {
            await getSupabase().from("messages").insert({
              conversation_id: conversation.id,
              account_id: account.id,
              direction: "outgoing",
              content: matchedReply.response,
              type: "text",
              is_ai: true,
              delivery_status: keywordDelivered ? "delivered" : "failed",
            });
          } catch (dbErr) {
            console.warn(`[PROCESSOR] Failed to store keyword reply:`, dbErr.message);
          }

          // Track first response time
          if (!conversation.first_response_at) {
            await getSupabase()
              .from("conversations")
              .update({ first_response_at: new Date().toISOString() })
              .eq("id", conversation.id);
          }

          // Keyword reply handled, skip AI — but ONLY if delivery succeeded.
          // If delivery failed, fall through to AI so the customer still gets a reply.
          if (keywordDelivered) {
            return;
          } else {
            console.log(`[PROCESSOR] Keyword matched but delivery failed — falling through to AI reply`);
          }
        }
      }
    }

    // ─── 10. AI Auto-Reply (with rate limiting + error handling) ───
    console.log(`[PROCESSOR] AI check: ai_enabled=${account.ai_enabled}, hasText=${!!text}, hasMedia=${mediaUrls.length > 0}, channel=${channel}, hasAccessToken=${!!accessToken}, accountId=${account.id}, faqMatched=${faqMatchedAndReplied}`);
    // AI triggers if: text exists OR images were sent (vision AI can analyze images)
    // AND FAQ hasn't already handled this message with a high-confidence match
    if (account.ai_enabled && (text || mediaUrls.length > 0) && !faqMatchedAndReplied) {
      try {
        // ─── 10a. Check per-conversation AI pause (operator "Take over" / escalation) ───
        const { paused, reason } = await isAiPaused(conversation.id);
        if (paused) {
          console.log(`[PROCESSOR] AI paused for conversation ${conversation.id}: ${reason}. Skipping AI reply.`);
          // Record an event so the operator sees the customer tried to reach out
          try {
            await getSupabase().from("conversation_events").insert({
              conversation_id: conversation.id,
              account_id: account.id,
              event_type: "ai_skipped_paused",
              metadata: { reason },
            });
          } catch (e) { /* ignore */ }
          // Do NOT send anything to the customer — the operator will reply manually
          return;
        }

        // Check daily AI rate limit per account (plan-aware)
        const planLimits = getPlanLimits(account.plan || "starter");
        const MAX_AI_PER_ACCOUNT_PER_DAY = planLimits.ai_replies_per_day;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Skip rate check if plan is unlimited (-1)
        let aiCount = 0;
        if (MAX_AI_PER_ACCOUNT_PER_DAY !== -1) {
          const { count } = await getSupabase()
            .from("rate_limits")
            .select("*", { count: "exact", head: true })
            .eq("email", account.id)
            .eq("action", "ai_auto_reply")
            .gte("created_at", oneDayAgo);
          aiCount = count || 0;
        }

        console.log(`[PROCESSOR] AI rate limit: ${aiCount}/${MAX_AI_PER_ACCOUNT_PER_DAY} (plan: ${account.plan})`);

        if (MAX_AI_PER_ACCOUNT_PER_DAY !== -1 && aiCount >= MAX_AI_PER_ACCOUNT_PER_DAY) {
          console.warn(`Account ${account.id} exceeded daily AI limit (${MAX_AI_PER_ACCOUNT_PER_DAY})`);
          // Skip AI reply silently — message is still stored
        } else {
          // Log the AI request
          await getSupabase().from("rate_limits").insert({
            email: account.id, // Using email column to store account_id for this action type
            action: "ai_auto_reply",
          });

          console.log(`[PROCESSOR] Generating AI reply for account ${account.id}, conversation ${conversation.id}, message: "${text?.substring(0, 50)}..."`);

          // Fetch products for AI context (including variants like sizes/colors)
          const { data: products } = await getSupabase()
            .from("products")
            .select("name, price, description, category, stock, variants")
            .eq("account_id", account.id)
            .eq("status", "active")
            .limit(50);

          // Fetch recent conversation history for context
          const { data: recentMessages } = await getSupabase()
            .from("messages")
            .select("content, direction")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: false })
            .limit(8);

          const history = (recentMessages || []).reverse();

          // ─── Step 9.5: Show typing indicator on customer's channel ───
          // Best-effort: failures are swallowed inside the helper
          const typingParams = {
            channel,
            recipientId: senderId,
            phoneNumberId: account.whatsapp_phone_number_id,
            accessToken: channel === "whatsapp" ? (account.whatsapp_access_token || accessToken) : accessToken,
            pageId,
          };
          await showTypingIndicator(typingParams);

          // Use vision AI if customer sent images, otherwise standard AI reply
          let aiResult;
          let aiFailed = false;
          try {
            aiResult = mediaUrls.length > 0
              ? await generateAIReplyWithVision({
                  accountId: account.id,
                  customerId: customer.id,
                  conversationId: conversation.id,
                  customerMessage: text || "",
                  customerName: customer.name,
                  personality: account.ai_personality,
                  country: account.country,
                  businessName: account.business_name,
                  conversationHistory: history,
                  plan: account.plan,
                  mediaUrls,
                })
              : await generateAIReply({
                  accountId: account.id,
                  customerId: customer.id,
                  conversationId: conversation.id,
                  customerMessage: text,
                  customerName: customer.name,
                  personality: account.ai_personality,
                  country: account.country,
                  businessName: account.business_name,
                  conversationHistory: history,
                  plan: account.plan,
                });
          } catch (aiErr) {
            console.error(`[PROCESSOR] AI generation threw: ${aiErr.message}`);
            aiFailed = true;
          }

          // ─── B3: AI failure fallback → escalate to human ───
          if (aiFailed || !aiResult || !aiResult.reply) {
            console.error(`[PROCESSOR] All AI providers failed — escalating to human queue`);
            await sendAiFailureFallback({
              channel,
              recipientId: senderId,
              phoneNumberId: account.whatsapp_phone_number_id,
              accessToken: channel === "whatsapp" ? (account.whatsapp_access_token || accessToken) : accessToken,
              pageId,
              businessName: account.business_name,
            });
            await escalateToHuman(
              conversation.id,
              aiFailed ? "AI generation threw an error" : "AI returned empty reply",
              account.id
            );
            return;
          }

          console.log(`[PROCESSOR] AI result: reply=${!!aiResult?.reply}, intent=${aiResult?.intent}, sentiment=${aiResult?.sentiment}, replyLength=${aiResult?.reply?.length}`);

          // ─── B5: Auto-escalate on negative sentiment ───
          // If the customer is clearly angry/frustrated, route to a human
          if (aiResult?.sentiment === "negative" && aiResult?.intent === "complaint") {
            console.log(`[PROCESSOR] Negative sentiment + complaint → escalating to human`);
            // Still send the AI's reply (it might be a good de-escalation), but flag for human follow-up
            await escalateToHuman(
              conversation.id,
              "Auto-escalated: negative sentiment + complaint intent",
              account.id
            );
          }

          // ─── H1: Human-feeling reply delay (1.5–3s) ───
          // Wait until the AI is done, then add a short throttle so the reply
          // doesn't appear in <1s (feels robotic). Typing indicator continues during this delay.
          await humanReplyDelay(aiResult.reply);

          if (aiResult && aiResult.reply) {
            const aiReply = aiResult.reply;
            console.log(`[PROCESSOR] AI reply generated (${aiReply.length} chars): "${aiReply.substring(0, 80)}..."`);

            // ─── Step 10a: Send AI reply via Meta/WhatsApp (best-effort) ───
            // This is wrapped in its own try/catch because Meta delivery failure
            // should NOT prevent the AI reply from being stored in the database.
            // The business owner can still see the AI reply in the conversations page.
            let deliverySuccess = false;
            try {
              deliverySuccess = await sendChannelReply({
                channel, senderId, message: aiReply, account, accessToken, pageId,
              });
              if (!deliverySuccess) {
                console.warn(`[PROCESSOR] No token available for ${channel} — AI reply stored but NOT delivered to customer`);
              }
            } catch (deliveryErr) {
              console.error(`[PROCESSOR] AI reply delivery failed for ${channel}:`, deliveryErr.message);
              console.error(`[PROCESSOR] AI reply is still saved to database but customer did NOT receive it on ${channel}`);
              // Continue to store the AI reply in DB even if delivery failed
            }

            // ─── Step 10b: ALWAYS store AI reply in database ───
            // This must happen regardless of whether Meta delivery succeeded.
            // Otherwise, AI replies are lost when delivery fails.
            const responseTime = Math.round((Date.now() - (conversation.last_message_at ? new Date(conversation.last_message_at).getTime() : Date.now())) / 1000);

            try {
              const { data: insertedMsg } = await getSupabase().from("messages").insert({
                conversation_id: conversation.id,
                account_id: account.id,
                direction: "outgoing",
                content: aiReply,
                type: "text",
                is_ai: true,
                response_time_seconds: responseTime,
                sentiment: aiResult.sentiment || null,
                tool_calls: aiResult.toolCalls ? JSON.stringify(aiResult.toolCalls) : null,
                delivery_status: deliverySuccess ? "delivered" : "failed",
              }).select("id").single();

              // ─── Track deflection: AI replied → record first_ai_reply_at if not set ───
              if (insertedMsg?.id) {
                await getSupabase()
                  .from("conversations")
                  .update({
                    last_ai_message_id: insertedMsg.id,
                    first_ai_reply_at: conversation.first_ai_reply_at ? undefined : new Date().toISOString(),
                  })
                  .eq("id", conversation.id);
                await trackDeflection(conversation.id, "ai");
              }
            } catch (dbErr) {
              console.error(`[PROCESSOR] Failed to store AI reply in database:`, dbErr.message);
            }

            if (aiResult.toolCalls && aiResult.toolCalls.length > 0) {
              try {
                for (const toolCall of aiResult.toolCalls) {
                    await getSupabase().from("agent_actions").insert({
                        account_id: account.id,
                        conversation_id: conversation.id,
                        agent_type: aiResult.intent,
                        tool_name: toolCall.toolName,
                        tool_input: toolCall.args,
                        success: true,
                    });
                }
              } catch (actionErr) {
                console.error(`[PROCESSOR] Failed to log agent action:`, actionErr.message);
              }
            }

            // Track first response time
            if (!conversation.first_response_at) {
              await getSupabase()
                .from("conversations")
                .update({ first_response_at: new Date().toISOString() })
                .eq("id", conversation.id);
            }

            console.log(`[PROCESSOR] AI auto-reply generated and ${deliverySuccess ? 'delivered' : 'saved (delivery failed)'} for conversation ${conversation.id}`);

            // ─── Step 10c: Handle AI Escalation (notify owner) ───
            if (aiResult.needsHumanAttention && aiResult.escalationReason) {
              try {
                console.log(`[PROCESSOR] AI ESCALATION detected for conversation ${conversation.id}: ${aiResult.escalationReason}`);

                // 1. Update conversation status to "needs_attention" and add escalation tag
                const currentTags = conversation.tags || [];
                const escalationTag = "escalated:ai";
                const reasonTag = `escalation:${aiResult.escalationReason.substring(0, 50)}`;
                const newTags = [...new Set([...currentTags, escalationTag, reasonTag])];

                await getSupabase()
                  .from("conversations")
                  .update({
                    status: "needs_attention",
                    tags: newTags,
                  })
                  .eq("id", conversation.id);

                // 2. Store escalation notification for the owner (resilient to missing table)
                try {
                  await getSupabase().from("notifications").insert({
                    account_id: account.id,
                    type: "ai_escalation",
                    title: "AI Needs Your Help",
                    message: `Customer "${customer.name || 'Unknown'}" in a ${channel} conversation needs human attention: ${aiResult.escalationReason}`,
                    data: {
                      conversation_id: conversation.id,
                      customer_id: customer.id,
                      customer_name: customer.name,
                      channel: channel,
                      escalation_reason: aiResult.escalationReason,
                      original_message: text?.substring(0, 200),
                      ai_reply_preview: aiReply?.substring(0, 200),
                      intent: aiResult.intent,
                      sentiment: aiResult.sentiment,
                    },
                    read: false,
                  });
                } catch (notifErr) {
                  console.warn(`[PROCESSOR] Failed to store notification (table may not exist yet):`, notifErr.message);
                  console.warn(`[PROCESSOR] Run migration: /api/admin/setup-db?adminKey=<YOUR_ADMIN_KEY>`);
                }

                // 3. Send email notification to the owner (best-effort)
                try {
                  const { data: accountEmail } = await getSupabase()
                    .from("accounts")
                    .select("email, notify_escalations")
                    .eq("id", account.id)
                    .single();

                  if (accountEmail?.notify_escalations !== false) {
                    // Fire and forget — don't block the pipeline
                    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''}/api/notifications/email`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        accountId: account.id,
                        type: "ai_escalation",
                        to: accountEmail?.email,
                        customerName: customer.name || "A customer",
                        channel,
                        reason: aiResult.escalationReason,
                        conversationId: conversation.id,
                      }),
                    }).catch(() => {}); // Silently ignore email failures
                  }
                } catch (emailErr) {
                  // Email notification failure should not block anything
                  console.warn(`[PROCESSOR] Escalation email failed:`, emailErr.message);
                }

                console.log(`[PROCESSOR] Escalation notification stored for account ${account.id}, conversation ${conversation.id}`);
              } catch (escalationErr) {
                console.error(`[PROCESSOR] Failed to process AI escalation:`, escalationErr.message);
              }
            }
          } // end if aiResult.reply
        } // end else (not rate limited)
      } catch (aiErr) {
        // AI failure should never break message processing
        console.error(`[PROCESSOR] AI auto-reply FAILED for account ${account?.id}:`, aiErr.message);
        console.error(`[PROCESSOR] AI error stack:`, aiErr.stack?.substring(0, 500));
      }
    } else {
      if (!account.ai_enabled) {
        console.log(`[PROCESSOR] AI skipped: ai_enabled is false for account ${account.id}`);
      }
      if (!text && mediaUrls.length === 0) {
        console.log(`[PROCESSOR] AI skipped: no text content or images in message`);
      }
      if (faqMatchedAndReplied) {
        console.log(`[PROCESSOR] AI skipped: FAQ auto-reply already handled this message`);
      }
    }

  } catch (err) {
    console.error(`Error processing ${channel} message:`, err);
    throw err;
  }
}

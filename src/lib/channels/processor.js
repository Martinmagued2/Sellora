/**
 * Shared Channel Message Processor
 * 
 * This is the core pipeline that ALL channels (IG, FB, later WhatsApp) use.
 * It handles: Customer upsert → Conversation upsert → Message storage → AI reply
 * 
 * By centralizing this, we guarantee consistent behavior across channels.
 */

import { createClient } from "@supabase/supabase-js";
import { generateAIReply, analyzeIntent } from "@/lib/ai";
import { sendMessage } from "@/lib/channels/meta";
import { getPlanLimits } from "@/lib/plan-limits";
import { dispatchWebhook } from "@/lib/webhooks";

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
 * Process an incoming message from any channel
 * 
 * @param {Object} params
 * @param {string} params.senderId - Platform user ID (IGSID, PSID)
 * @param {string} params.senderName - Display name (if available from profile)
 * @param {string} params.senderProfilePic - Profile picture URL
 * @param {string} params.text - Message text content
 * @param {string[]} params.mediaUrls - Attachment URLs
 * @param {string} params.channel - 'instagram' | 'facebook'
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
  channel,
  pageId,
  platformMessageId,
  accessToken,
}) {
  try {
    // ─── 1. Find the account that owns this page ───
    const pageColumn = channel === "instagram" ? "instagram_page_id" : "facebook_page_id";
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, ai_enabled, ai_personality, plan")
      .eq(pageColumn, pageId)
      .single();

    if (accountError || !account) {
      console.error(`No account found for ${channel} page ${pageId}`);
      return;
    }

    // ─── 2. Find or create customer ───
    let { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("account_id", account.id)
      .eq("platform_id", senderId)
      .single();

    if (!customer) {
      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          account_id: account.id,
          name: senderName || "Unknown",
          platform_id: senderId,
          platform: channel,
          channel: channel,
          profile_pic_url: senderProfilePic || null,
          first_seen_at: new Date().toISOString(),
          is_returning: false,
        })
        .select()
        .single();

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
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("account_id", account.id)
      .eq("customer_id", customer.id)
      .eq("channel", channel)
      .in("status", ["new", "open", "in_progress", "waiting_customer"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          account_id: account.id,
          customer_id: customer.id,
          channel: channel,
          status: "new",
          platform_thread_id: senderId, // Thread is per-user on IG/FB
        })
        .select()
        .single();

      conversation = newConv;
    }

    // ─── 4. Detect intent ───
    let intent = null;
    if (text) {
      try {
        const intentResult = await analyzeIntent(text);
        intent = intentResult?.intent || null;
      } catch (e) {
        console.warn("Intent detection failed:", e.message);
      }
    }

    // ─── 5. Store the incoming message ───
    const messageType = mediaUrls.length > 0 ? "image" : "text";
    const { error: insertError } = await getSupabase().from("messages").insert({
      conversation_id: conversation.id,
      direction: "incoming",
      content: text,
      type: messageType,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      platform_message_id: platformMessageId,
      intent: intent,
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

    // ─── 6. Update conversation metadata ───
    const convUpdates = {
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
    };
    
    // If status is "waiting_customer", move back to "in_progress"
    if (conversation.status === "waiting_customer") {
      convUpdates.status = "in_progress";
    }

    await supabase
      .from("conversations")
      .update(convUpdates)
      .eq("id", conversation.id);

    // ─── 7. Auto-tag conversation based on intent ───
    if (intent && intent !== "general") {
      const currentTags = conversation.tags || [];
      const intentTag = `intent:${intent}`;
      if (!currentTags.includes(intentTag)) {
        await supabase
          .from("conversations")
          .update({ tags: [...currentTags, intentTag] })
          .eq("id", conversation.id);
      }
    }

    // ─── 8. Check keyword auto-replies first ───
    if (text) {
      const { data: autoReplies } = await supabase
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
          // Send the auto-reply
          await sendMessage({
            recipientId: senderId,
            message: matchedReply.response,
            pageId,
            accessToken,
          });

          // Store it
          await getSupabase().from("messages").insert({
            conversation_id: conversation.id,
            direction: "outgoing",
            content: matchedReply.response,
            type: "text",
            is_ai: true,
          });

          // Track first response time
          if (!conversation.first_response_at) {
            await supabase
              .from("conversations")
              .update({ first_response_at: new Date().toISOString() })
              .eq("id", conversation.id);
          }

          return; // Keyword reply handled, skip AI
        }
      }
    }

    // ─── 9. AI Auto-Reply (with rate limiting + error handling) ───
    if (account.ai_enabled && text) {
      try {
        // Check daily AI rate limit per account (plan-aware)
        const planLimits = getPlanLimits(account.plan || "starter");
        const MAX_AI_PER_ACCOUNT_PER_DAY = planLimits.ai_replies_per_day;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Skip rate check if plan is unlimited (-1)
        let aiCount = 0;
        if (MAX_AI_PER_ACCOUNT_PER_DAY !== -1) {
          const { count } = await supabase
            .from("rate_limits")
            .select("*", { count: "exact", head: true })
            .eq("email", account.id)
            .eq("action", "ai_auto_reply")
            .gte("created_at", oneDayAgo);
          aiCount = count || 0;
        }

        if (MAX_AI_PER_ACCOUNT_PER_DAY !== -1 && aiCount >= MAX_AI_PER_ACCOUNT_PER_DAY) {
          console.warn(`Account ${account.id} exceeded daily AI limit (${MAX_AI_PER_ACCOUNT_PER_DAY})`);
          // Skip AI reply silently — message is still stored
        } else {
          // Log the AI request
          await getSupabase().from("rate_limits").insert({
            email: account.id, // Using email column to store account_id for this action type
            action: "ai_auto_reply",
          });

          // Fetch products for AI context
          const { data: products } = await supabase
            .from("products")
            .select("name, price, description, category")
            .eq("account_id", account.id)
            .eq("status", "active")
            .limit(50);

          // Fetch recent conversation history for context
          const { data: recentMessages } = await supabase
            .from("messages")
            .select("content, direction")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: false })
            .limit(8);

          const history = (recentMessages || []).reverse();

          const aiResult = await generateAIReply({
            accountId: account.id,
            customerId: customer.id,
            customerMessage: text,
            customerName: customer.name,
            personality: account.ai_personality,
            country: account.country,
            businessName: account.business_name,
            conversationHistory: history,
            plan: account.plan,
          });

          if (aiResult && aiResult.reply) {
            const aiReply = aiResult.reply;
            // Send AI reply back to the customer's IG/FB
            await sendMessage({
              recipientId: senderId,
              message: aiReply,
              pageId,
              accessToken,
            });

            // Calculate response time
            const responseTime = Math.round((Date.now() - (conversation.last_message_at ? new Date(conversation.last_message_at).getTime() : Date.now())) / 1000);

            // Store AI reply in database
            await getSupabase().from("messages").insert({
              conversation_id: conversation.id,
              direction: "outgoing",
              content: aiReply,
              type: "text",
              is_ai: true,
              response_time_seconds: responseTime,
              agent_type: aiResult.intent,
              tool_calls: aiResult.toolCalls ? JSON.stringify(aiResult.toolCalls) : null,
            });

            if (aiResult.toolCalls && aiResult.toolCalls.length > 0) {
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
            }

            // Track first response time
            if (!conversation.first_response_at) {
              await supabase
                .from("conversations")
                .update({ first_response_at: new Date().toISOString() })
                .eq("id", conversation.id);
            }
          }
        }
      } catch (aiErr) {
        // AI failure should never break message processing
        console.error("AI auto-reply failed (non-fatal):", aiErr.message);
      }
    }

  } catch (err) {
    console.error(`Error processing ${channel} message:`, err);
    throw err;
  }
}

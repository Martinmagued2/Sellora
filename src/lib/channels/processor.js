/**
 * Shared Channel Message Processor
 * 
 * This is the core pipeline that ALL channels (IG, FB, WhatsApp) use.
 * It handles: Customer upsert → Conversation upsert → Message storage → AI reply
 * 
 * By centralizing this, we guarantee consistent behavior across channels.
 */

import { createClient } from "@supabase/supabase-js";
import { generateAIReply, analyzeIntent } from "@/lib/ai";
import { sendMessage } from "@/lib/channels/meta";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
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
  channel,
  pageId,
  platformMessageId,
  accessToken,
  accountId: providedAccountId, // Optional: passed by webhook handler to resolve duplicate page_ids
}) {
  try {
    // ─── 1. Find the account that owns this page ───
    const pageColumn = channel === "instagram" ? "instagram_page_id" : channel === "whatsapp" ? "whatsapp_phone_number_id" : "facebook_page_id";

    // Step 1a: Fetch core columns that MUST exist
    // If accountId was provided (from webhook handler that already resolved duplicates), use it directly
    let account;
    if (providedAccountId) {
      const { data: directAccount, error: directError } = await getSupabase()
        .from("accounts")
        .select("id, ai_enabled, ai_personality, plan, business_name, country, whatsapp_phone_number_id, whatsapp_access_token")
        .eq("id", providedAccountId)
        .single();

      if (directError || !directAccount) {
        console.error(`[PROCESSOR] Account lookup by ID failed for ${providedAccountId}:`, directError?.message);
        return;
      }
      account = directAccount;
    } else {
      // No accountId provided — look up by page ID (handle duplicates gracefully)
      const { data: accounts, error: accountError } = await getSupabase()
        .from("accounts")
        .select("id, ai_enabled, ai_personality, plan, business_name, country, whatsapp_phone_number_id, whatsapp_access_token")
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
      .single();

    const isNewCustomer = !customer;

    if (!customer) {
      const { data: newCustomer } = await getSupabase()
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
    let { data: conversation } = await getSupabase()
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
      const { data: newConv } = await getSupabase()
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
    const messageType = mediaUrls.length > 0 ? "image" : "text";
    const { error: insertError } = await getSupabase().from("messages").insert({
      conversation_id: conversation.id,
      account_id: account.id,
      direction: "incoming",
      content: text,
      type: messageType,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
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

        // Send greeting via the appropriate channel
        if (channel === "whatsapp") {
          await sendWhatsAppMessage({
            to: senderId,
            message: greetingMessage,
            phoneNumberId: account.whatsapp_phone_number_id,
          });
        } else {
          await sendMessage({
            recipientId: senderId,
            message: greetingMessage,
            pageId,
            accessToken,
          });
        }

        // Store the greeting message
        await getSupabase().from("messages").insert({
          conversation_id: conversation.id,
          account_id: account.id,
          direction: "outgoing",
          content: greetingMessage,
          type: "text",
          is_ai: false,
        });

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

          const scored = faqs.map((faq) => {
            let score = 0;
            const qLower = (faq.question || "").toLowerCase();
            const aLower = (faq.answer || "").toLowerCase();
            const cLower = (faq.category || "").toLowerCase();
            const allText = `${qLower} ${aLower} ${cLower}`;

            for (const term of searchTerms) {
              if (qLower.includes(term)) score += 10;
              if (cLower.includes(term)) score += 8;
              if (aLower.includes(term)) score += 5;
              if (allText.includes(term)) score += 2;
            }

            return { ...faq, score };
          });

          const bestMatch = scored
            .filter((f) => f.score > 0)
            .sort((a, b) => b.score - a.score)[0];

          // Only use FAQ auto-reply if the match score is high enough
          if (bestMatch && bestMatch.score >= 10) {
            // Send the FAQ answer via the appropriate channel
            if (channel === "whatsapp") {
              await sendWhatsAppMessage({
                to: senderId,
                message: bestMatch.answer,
                phoneNumberId: account.whatsapp_phone_number_id,
              });
            } else {
              await sendMessage({
                recipientId: senderId,
                message: bestMatch.answer,
                pageId,
                accessToken,
              });
            }

            // Store it
            await getSupabase().from("messages").insert({
              conversation_id: conversation.id,
              account_id: account.id,
              direction: "outgoing",
              content: bestMatch.answer,
              type: "text",
              is_ai: true,
            });

            // Track first response time
            if (!conversation.first_response_at) {
              await getSupabase()
                .from("conversations")
                .update({ first_response_at: new Date().toISOString() })
                .eq("id", conversation.id);
            }

            // FAQ reply handled, skip keyword and AI
            return;
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
          // Send the auto-reply via the appropriate channel
          if (channel === "whatsapp") {
            await sendWhatsAppMessage({
              to: senderId,
              message: matchedReply.response,
              phoneNumberId: account.whatsapp_phone_number_id,
            });
          } else {
            await sendMessage({
              recipientId: senderId,
              message: matchedReply.response,
              pageId,
              accessToken,
            });
          }

          // Store it
          await getSupabase().from("messages").insert({
            conversation_id: conversation.id,
            account_id: account.id,
            direction: "outgoing",
            content: matchedReply.response,
            type: "text",
            is_ai: true,
          });

          // Track first response time
          if (!conversation.first_response_at) {
            await getSupabase()
              .from("conversations")
              .update({ first_response_at: new Date().toISOString() })
              .eq("id", conversation.id);
          }

          return; // Keyword reply handled, skip AI
        }
      }
    }

    // ─── 10. AI Auto-Reply (with rate limiting + error handling) ───
    if (account.ai_enabled && text) {
      try {
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
          const { data: products } = await getSupabase()
            .from("products")
            .select("name, price, description, category")
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
            // Send AI reply via the appropriate channel
            if (channel === "whatsapp") {
              await sendWhatsAppMessage({
                to: senderId,
                message: aiReply,
                phoneNumberId: account.whatsapp_phone_number_id,
              });
            } else {
              await sendMessage({
                recipientId: senderId,
                message: aiReply,
                pageId,
                accessToken,
              });
            }

            // Calculate response time
            const responseTime = Math.round((Date.now() - (conversation.last_message_at ? new Date(conversation.last_message_at).getTime() : Date.now())) / 1000);

            // Store AI reply in database
            await getSupabase().from("messages").insert({
              conversation_id: conversation.id,
              account_id: account.id,
              direction: "outgoing",
              content: aiReply,
              type: "text",
              is_ai: true,
              response_time_seconds: responseTime,
              sentiment: aiResult.sentiment || null,
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
              await getSupabase()
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

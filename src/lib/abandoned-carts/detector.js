/**
 * Abandoned Cart Detector
 *
 * Scans conversations and detects potential abandoned carts.
 * Looks for conversations where:
 * - Customer expressed purchase intent
 * - Products were discussed/shared
 * - No order was created
 *
 * Uses AI intent data from messages to identify purchase intent.
 */

import { createClient } from "@supabase/supabase-js";

// Lazy-initialized admin client
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
 * Purchase intent keywords organized by category
 */
const INTENT_KEYWORDS = {
  purchase: [
    "buy", "order", "purchase", "get", "take", "want to buy",
    "place an order", "make an order", "i'll take", "i want",
  ],
  pricing: [
    "price", "cost", "how much", "what's the price", "expensive",
    "cheap", "discount", "offer", "deal", "total",
  ],
  availability: [
    "available", "in stock", "do you have", "is it available",
    "can i get", "when will", "restock",
  ],
  checkout: [
    "checkout", "pay", "payment", "deliver", "shipping",
    "ship to", "address", "cash on delivery", "cod",
  ],
};

/**
 * Detect if a message contains purchase intent
 * @param {string} content - Message content
 * @param {string} direction - "incoming" or "outgoing"
 * @returns {{ hasIntent: boolean, categories: string[], confidence: number }}
 */
function analyzeMessageIntent(content, direction) {
  if (!content) return { hasIntent: false, categories: [], confidence: 0 };

  const lowerContent = content.toLowerCase();
  const matchedCategories = [];
  let totalMatches = 0;

  for (const [category, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const matches = keywords.filter(kw => lowerContent.includes(kw));
    if (matches.length > 0) {
      matchedCategories.push(category);
      totalMatches += matches.length;
    }
  }

  // For incoming messages, purchase intent is more significant
  const confidence = direction === "incoming"
    ? Math.min(totalMatches * 0.3, 1)
    : Math.min(totalMatches * 0.15, 0.6);

  return {
    hasIntent: matchedCategories.length > 0,
    categories: matchedCategories,
    confidence,
  };
}

/**
 * Extract product items from a list of messages
 * @param {Array} messages - List of message objects
 * @returns {Array} - List of extracted items with name, price, qty
 */
function extractProductItems(messages) {
  const items = [];
  const seenNames = new Set();

  for (const msg of messages) {
    // Extract from product card type messages
    if (msg.type === "product_card") {
      try {
        const product = typeof msg.metadata === "string"
          ? JSON.parse(msg.metadata)
          : msg.metadata || {};

        const name = product.name || product.title;
        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          items.push({
            name,
            price: parseFloat(product.price) || 0,
            qty: parseInt(product.qty) || 1,
            image: product.image || product.image_url || null,
            source: "product_card",
          });
        }
      } catch (e) {
        // Skip invalid metadata
      }
    }

    // Extract from message content with product patterns
    const content = msg.content || "";

    // Pattern 1: "Product Name - EGP 100" or "Product Name: 100 EGP"
    const pricePatterns = [
      /(.+?)[\s]*[-–:][\s]*(\d+(?:\.\d+)?)\s*(?:EGP|LE|egp|le|\$)/gi,
      /(?:EGP|LE|egp|le|\$)\s*(\d+(?:\.\d+)?)\s*[-–:]\s*(.+)/gi,
    ];

    for (const pattern of pricePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null && items.length < 10) {
        const name = (match[1] || match[2] || "").trim();
        const price = parseFloat(match[2] || match[1] || 0);

        if (name.length > 2 && price > 0 && !seenNames.has(name)) {
          seenNames.add(name);
          items.push({
            name,
            price,
            qty: 1,
            image: null,
            source: "message_content",
          });
        }
      }
    }

    // Pattern 2: Product names from shared product lists
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for numbered items like "1. Product Name" or bullet points
      const itemMatch = trimmed.match(/^(?:\d+[\.\)]\s*|[-•]\s*)(.+?)(?:\s*[-–]\s*(\d+))?\s*$/);
      if (itemMatch) {
        const name = itemMatch[1].trim();
        if (name.length > 2 && name.length < 100 && !seenNames.has(name)) {
          // Only add if there are other indicators this is a product list
          if (content.includes("EGP") || content.includes("egp") || content.includes("$")) {
            seenNames.add(name);
            items.push({
              name,
              price: parseFloat(itemMatch[2]) || 0,
              qty: 1,
              image: null,
              source: "product_list",
            });
          }
        }
      }
    }
  }

  return items;
}

/**
 * Detect abandoned carts for an account
 *
 * @param {string} accountId - The account ID to scan
 * @param {Object} options - Detection options
 * @param {number} options.hoursBeforeAbandoned - Hours of inactivity (default: 2)
 * @param {number} options.minConfidence - Minimum intent confidence threshold (default: 0.2)
 * @param {number} options.maxConversations - Max conversations to process (default: 50)
 * @returns {Promise<{ detected: number, carts: Array, errors: Array }>}
 */
export async function detectAbandonedCarts(accountId, options = {}) {
  const {
    hoursBeforeAbandoned = 2,
    minConfidence = 0.2,
    maxConversations = 50,
  } = options;

  const supabase = getSupabase();
  const cutoffTime = new Date(Date.now() - hoursBeforeAbandoned * 60 * 60 * 1000).toISOString();

  // 1. Find active conversations with no recent activity
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select(`
      id, channel, customer_id, account_id,
      last_message_at, created_at,
      customer:customers(id, name, email, phone, channel, platform_id)
    `)
    .eq("account_id", accountId)
    .in("status", ["new", "open", "in_progress", "waiting_customer"])
    .lt("last_message_at", cutoffTime)
    .order("last_message_at", { ascending: false })
    .limit(maxConversations);

  if (convError) {
    console.error("[DETECTOR] Error fetching conversations:", convError);
    return { detected: 0, carts: [], errors: [convError.message] };
  }

  if (!conversations || conversations.length === 0) {
    return { detected: 0, carts: [], errors: [] };
  }

  // 2. Get existing abandoned cart conversation_ids to avoid duplicates
  const { data: existingCarts } = await supabase
    .from("abandoned_carts")
    .select("conversation_id")
    .eq("account_id", accountId);

  const existingConvIds = new Set(
    (existingCarts || []).map(c => c.conversation_id).filter(Boolean)
  );

  // 3. Get recent orders to check if customers already purchased
  const customerIds = conversations.map(c => c.customer_id).filter(Boolean);

  const { data: recentOrders } = await supabase
    .from("orders")
    .select("customer_id, created_at")
    .eq("account_id", accountId)
    .in("customer_id", customerIds)
    .gte("created_at", cutoffTime);

  const customersWithOrders = new Set(
    (recentOrders || []).map(o => o.customer_id)
  );

  const detectedCarts = [];
  const errors = [];

  for (const conv of conversations) {
    try {
      // Skip if already tracked
      if (existingConvIds.has(conv.id)) continue;

      // Skip if customer already placed an order
      if (customersWithOrders.has(conv.customer_id)) continue;

      // 4. Analyze messages for purchase intent
      const { data: messages } = await supabase
        .from("messages")
        .select("content, direction, type, metadata, is_ai, agent_type")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!messages || messages.length === 0) continue;

      // Analyze intent for each incoming message
      let maxConfidence = 0;
      let intentCategories = new Set();
      let hasProductCard = false;

      for (const msg of messages) {
        if (msg.direction === "incoming") {
          const intent = analyzeMessageIntent(msg.content, "incoming");
          maxConfidence = Math.max(maxConfidence, intent.confidence);
          intent.categories.forEach(c => intentCategories.add(c));
        }

        if (msg.type === "product_card") {
          hasProductCard = true;
          maxConfidence = Math.max(maxConfidence, 0.5);
          intentCategories.add("product_discussed");
        }

        // Check AI agent messages for product recommendations
        if (msg.direction === "outgoing" && (msg.is_ai || msg.agent_type)) {
          const content = (msg.content || "").toLowerCase();
          if (
            content.includes("price") || content.includes("egp") ||
            content.includes("available") || content.includes("order") ||
            content.includes("recommend") || content.includes("suggest")
          ) {
            maxConfidence = Math.max(maxConfidence, 0.3);
            intentCategories.add("product_discussed");
          }
        }
      }

      // Skip if confidence is too low
      if (maxConfidence < minConfidence && !hasProductCard) continue;

      // 5. Extract product items from messages
      const items = extractProductItems(messages);

      // Calculate estimated cart value
      const cartValue = items.reduce(
        (sum, item) => sum + (item.price || 0) * (item.qty || 1), 0
      );

      // 6. Create abandoned cart entry
      const { data: newCart, error: insertError } = await supabase
        .from("abandoned_carts")
        .insert({
          account_id: accountId,
          customer_id: conv.customer_id,
          conversation_id: conv.id,
          channel: conv.channel,
          items,
          cart_value: cartValue,
          status: "abandoned",
          abandoned_at: conv.last_message_at,
        })
        .select(`
          *,
          customer:customers(id, name, email, phone, channel),
          conversation:conversations(id, channel, status)
        `)
        .single();

      if (insertError) {
        console.error("[DETECTOR] Insert error:", insertError);
        errors.push({ conversation_id: conv.id, error: insertError.message });
        continue;
      }

      detectedCarts.push({
        ...newCart,
        _intentConfidence: maxConfidence,
        _intentCategories: [...intentCategories],
      });
    } catch (err) {
      console.error(`[DETECTOR] Error processing conversation ${conv.id}:`, err);
      errors.push({ conversation_id: conv.id, error: err.message });
    }
  }

  return {
    detected: detectedCarts.length,
    carts: detectedCarts,
    errors,
  };
}

/**
 * Send automatic reminders for eligible abandoned carts
 *
 * @param {string} accountId - The account ID
 * @param {Object} options - Reminder options
 * @param {boolean} options.firstReminder - Whether to send first reminders
 * @param {boolean} options.secondReminder - Whether to send second reminders
 * @param {number} options.discountPercent - Discount for second reminder
 * @returns {Promise<{ sent: number, failed: number, results: Array }>}
 */
export async function sendAutomaticReminders(accountId, options = {}) {
  const {
    firstReminder = true,
    secondReminder = false,
    discountPercent = 10,
  } = options;

  const supabase = getSupabase();

  // Get account config
  const { data: account } = await supabase
    .from("accounts")
    .select("id, business_name, abandoned_cart_discount_percent")
    .eq("id", accountId)
    .single();

  const discount = discountPercent || account?.abandoned_cart_discount_percent || 10;

  // Find carts eligible for reminders
  const statusFilter = firstReminder ? "abandoned" : "reminded";
  const { data: carts } = await supabase
    .from("abandoned_carts")
    .select(`
      *,
      customer:customers(id, name, email, phone, channel, platform_id),
      conversation:conversations(id, channel, status, account_id)
    `)
    .eq("account_id", accountId)
    .eq("status", statusFilter);

  if (!carts || carts.length === 0) {
    return { sent: 0, failed: 0, results: [] };
  }

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const cart of carts) {
    try {
      if (!cart.conversation) {
        results.push({ cart_id: cart.id, status: "skipped", reason: "No conversation" });
        continue;
      }

      const items = Array.isArray(cart.items) ? cart.items : [];
      const itemsList = items.map(i => i.name || i.title || "Item").join(", ");
      const customerName = cart.customer?.name || "there";

      let message;
      if (secondReminder || cart.status === "reminded") {
        const couponCode = `SAVE${discount}${Date.now().toString(36).toUpperCase()}`;
        message = `Hey ${customerName}! We noticed you still haven't completed your order 🛒 ${itemsList}. Here's a special discount just for you: use code ${couponCode} for ${discount}% off! Don't miss out!`;

        await supabase
          .from("abandoned_carts")
          .update({ coupon_code: couponCode })
          .eq("id", cart.id);
      } else {
        message = `Hey ${customerName}! You left some items in your cart 🛒 ${itemsList}. Want to complete your order? We'd love to help you checkout!`;
      }

      // Send via the messages API
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const sendRes = await fetch(`${baseUrl}/api/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: cart.conversation.id,
          content: message,
          type: "text",
          channel: cart.channel,
        }),
      });

      if (!sendRes.ok) {
        const errData = await sendRes.json().catch(() => ({}));
        results.push({ cart_id: cart.id, status: "failed", error: errData.error });
        failed++;
        continue;
      }

      // Update cart status
      const updates = { status: "reminded" };
      if (secondReminder || cart.status === "reminded") {
        updates.second_reminder_at = new Date().toISOString();
      } else {
        updates.first_reminder_at = new Date().toISOString();
      }

      await supabase.from("abandoned_carts").update(updates).eq("id", cart.id);

      sent++;
      results.push({ cart_id: cart.id, status: "sent" });
    } catch (err) {
      failed++;
      results.push({ cart_id: cart.id, status: "failed", error: err.message });
    }
  }

  return { sent, failed, results };
}

/**
 * Mark expired carts (abandoned for more than 7 days without recovery)
 *
 * @param {string} accountId - The account ID
 * @param {number} expireAfterDays - Days after which to mark as expired (default: 7)
 * @returns {Promise<{ expired: number }>}
 */
export async function markExpiredCarts(accountId, expireAfterDays = 7) {
  const supabase = getSupabase();
  const expiryDate = new Date(Date.now() - expireAfterDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("abandoned_carts")
    .update({ status: "expired" })
    .eq("account_id", accountId)
    .in("status", ["abandoned", "reminded"])
    .lt("abandoned_at", expiryDate)
    .select("id");

  if (error) {
    console.error("[DETECTOR] Mark expired error:", error);
    return { expired: 0 };
  }

  return { expired: data?.length || 0 };
}

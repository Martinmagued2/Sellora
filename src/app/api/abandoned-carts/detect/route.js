import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Service role client (lazy-initialized)
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
 * POST /api/abandoned-carts/detect
 *
 * Called by automation/cron to detect new abandoned carts.
 * Finds conversations where customer asked about products but no order was created
 * in the last N hours.
 *
 * Body: {
 *   account_id (required),
 *   hours? (default: 2) - hours of inactivity before marking as abandoned
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { account_id, hours = 2 } = body;

    if (!account_id) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Find conversations where:
    // 1. Customer expressed purchase intent (products were discussed)
    // 2. No order was created
    // 3. Last message was more than N hours ago
    // 4. Not already tracked as an abandoned cart

    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select(`
        id,
        channel,
        customer_id,
        account_id,
        last_message_at,
        created_at,
        customer:customers(id, name, email, phone, channel, platform_id)
      `)
      .eq("account_id", account_id)
      .in("status", ["new", "open", "in_progress", "waiting_customer"])
      .lt("last_message_at", cutoffTime);

    if (convError) {
      console.error("[DETECT] Fetch conversations error:", convError);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ message: "No eligible conversations found", detected: 0 });
    }

    // Get existing abandoned cart conversation_ids to avoid duplicates
    const { data: existingCarts } = await supabase
      .from("abandoned_carts")
      .select("conversation_id")
      .eq("account_id", account_id);

    const existingConvIds = new Set((existingCarts || []).map(c => c.conversation_id).filter(Boolean));

    // Get recent orders for these customers to check if they already purchased
    const customerIds = conversations.map(c => c.customer_id).filter(Boolean);

    const { data: recentOrders } = await supabase
      .from("orders")
      .select("customer_id, created_at")
      .eq("account_id", account_id)
      .in("customer_id", customerIds)
      .gte("created_at", cutoffTime);

    const customersWithOrders = new Set((recentOrders || []).map(o => o.customer_id));

    let detected = 0;
    const results = [];

    for (const conv of conversations) {
      // Skip if already tracked
      if (existingConvIds.has(conv.id)) continue;

      // Skip if customer already placed an order
      if (customersWithOrders.has(conv.customer_id)) continue;

      // Analyze messages for purchase intent / product discussions
      const { data: messages } = await supabase
        .from("messages")
        .select("content, direction, type, metadata, is_ai, agent_type")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!messages || messages.length === 0) continue;

      // Detect purchase intent from messages
      const hasProductMention = detectProductIntent(messages);
      if (!hasProductMention) continue;

      // Extract items from messages (product cards shared, item mentions)
      const items = extractItems(messages);

      // Calculate estimated cart value from items
      const cartValue = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1), 0);

      // Create abandoned cart entry
      const { data: newCart, error: insertError } = await supabase
        .from("abandoned_carts")
        .insert({
          account_id,
          customer_id: conv.customer_id,
          conversation_id: conv.id,
          channel: conv.channel,
          items,
          cart_value: cartValue,
          status: "abandoned",
          abandoned_at: conv.last_message_at,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[DETECT] Insert error:", insertError);
        results.push({ conversation_id: conv.id, status: "failed", error: insertError.message });
        continue;
      }

      detected++;
      results.push({
        cart_id: newCart.id,
        conversation_id: conv.id,
        customer: conv.customer?.name || "Unknown",
        items: items.length,
        value: cartValue,
        status: "created",
      });
    }

    return NextResponse.json({
      message: `Detected ${detected} new abandoned cart(s)`,
      detected,
      total: conversations.length,
      results,
    });
  } catch (err) {
    console.error("[DETECT] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Detect if messages contain purchase intent / product discussions
 */
function detectProductIntent(messages) {
  const purchaseKeywords = [
    "buy", "order", "purchase", "price", "cost", "how much",
    "want", "need", "interested", "available", "stock", "deliver",
    "ship", "checkout", "cart", "add to cart", "pay", "payment",
    "discount", "offer", "deal", "promo", "sale",
  ];

  const productCardSent = messages.some(
    m => m.type === "product_card" || m.agent_type === "product_recommendation"
  );
  if (productCardSent) return true;

  // Check incoming messages for purchase intent keywords
  const incomingMessages = messages.filter(m => m.direction === "incoming");
  for (const msg of incomingMessages) {
    const content = (msg.content || "").toLowerCase();
    if (purchaseKeywords.some(kw => content.includes(kw))) {
      return true;
    }
  }

  // Check if AI shared product info (outgoing messages with product details)
  const outgoingMessages = messages.filter(m => m.direction === "outgoing");
  for (const msg of outgoingMessages) {
    const content = (msg.content || "").toLowerCase();
    if (
      content.includes("price") ||
      content.includes("egp") ||
      content.includes("$") ||
      content.includes("available") ||
      content.includes("order") ||
      msg.type === "product_card"
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract items from messages (product cards, order mentions)
 */
function extractItems(messages) {
  const items = [];

  for (const msg of messages) {
    // Extract from product card type
    if (msg.type === "product_card" && msg.metadata) {
      try {
        const product = typeof msg.metadata === "string" ? JSON.parse(msg.metadata) : msg.metadata;
        if (product.name || product.title) {
          items.push({
            name: product.name || product.title,
            price: parseFloat(product.price) || 0,
            qty: 1,
            image: product.image || product.image_url || null,
          });
        }
      } catch (e) {
        // Skip invalid metadata
      }
    }

    // Try to extract product names from message content
    const content = msg.content || "";
    const priceMatch = content.match(/(\d+)\s*(?:EGP|LE|egp|le|\$)/);
    if (priceMatch && items.length < 5) {
      // Look for product names near prices
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.includes("EGP") || line.includes("egp") || line.includes("$") || line.includes("LE")) {
          const nameMatch = line.match(/^(.+?)(?:\s*[-–]\s*|\s+)(?:\d+)/);
          if (nameMatch && nameMatch[1].trim().length > 2) {
            const existing = items.find(i => i.name === nameMatch[1].trim());
            if (!existing) {
              items.push({
                name: nameMatch[1].trim(),
                price: parseFloat(priceMatch[1]) || 0,
                qty: 1,
                image: null,
              });
            }
          }
        }
      }
    }
  }

  return items.slice(0, 10); // Limit to 10 items
}

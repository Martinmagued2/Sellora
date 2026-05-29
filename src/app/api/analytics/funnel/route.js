import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
 * GET /api/analytics/funnel?range=30d
 * Returns conversion funnel analytics with drop-off rates and channel breakdown
 */
export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        startDate = new Date("2020-01-01");
        break;
      case "30d":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, direction, type, is_ai, created_at, conversation_id, account_id")
      .eq("account_id", user.id)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    // Fetch conversations
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, channel, converted, created_at, status")
      .eq("account_id", user.id)
      .gte("created_at", startDate.toISOString());

    // Fetch orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, payment_status, channel, created_at, conversation_id")
      .eq("account_id", user.id)
      .gte("created_at", startDate.toISOString());

    const allMessages = messages || [];
    const allConversations = conversations || [];
    const allOrders = orders || [];

    // ─── Funnel Steps ───
    const incomingMessages = allMessages.filter(m => m.direction === "incoming");
    const productCardMessages = allMessages.filter(m => m.type === "product_card");
    const convIdsFromMessages = new Set(incomingMessages.map(m => m.conversation_id));
    const conversationsStarted = allConversations.length;
    const ordersCreated = allOrders.length;
    const ordersPaid = allOrders.filter(o => o.payment_status === "paid").length;

    // ─── Drop-off Rates ───
    const step1 = incomingMessages.length; // Messages received
    const step2 = conversationsStarted;     // Conversations started
    const step3 = productCardMessages.length; // Products sent
    const step4 = ordersCreated;           // Orders created
    const step5 = ordersPaid;              // Orders paid

    const dropoff = {
      messageToConversation: step1 > 0 ? ((1 - step2 / step1) * 100).toFixed(1) : 0,
      conversationToProduct: step2 > 0 ? ((1 - step3 / step2) * 100).toFixed(1) : 0,
      productToOrder: step3 > 0 ? ((1 - step4 / step3) * 100).toFixed(1) : step2 > 0 ? ((1 - step4 / step2) * 100).toFixed(1) : 0,
      orderToPaid: step4 > 0 ? ((1 - step5 / step4) * 100).toFixed(1) : 0,
    };

    // ─── Conversion Rates Between Steps ───
    const conversion = {
      messageToConversation: step1 > 0 ? ((step2 / step1) * 100).toFixed(1) : 0,
      conversationToProduct: step2 > 0 ? ((step3 / step2) * 100).toFixed(1) : 0,
      productToOrder: step3 > 0 ? ((step4 / step3) * 100).toFixed(1) : step2 > 0 ? ((step4 / step2) * 100).toFixed(1) : 0,
      orderToPaid: step4 > 0 ? ((step5 / step4) * 100).toFixed(1) : 0,
      overallConversion: step1 > 0 ? ((step5 / step1) * 100).toFixed(1) : 0,
    };

    // ─── Average Time Between Steps ───
    // Calculate average time from first incoming message to first product card per conversation
    const avgTimeBetweenSteps = {
      messageToProduct: null,
      productToOrder: null,
      orderToPaid: null,
    };

    // Message → Product time
    const msgToProductTimes = [];
    const convFirstMsg = {};
    const convFirstProduct = {};
    incomingMessages.forEach(m => {
      if (!convFirstMsg[m.conversation_id]) {
        convFirstMsg[m.conversation_id] = new Date(m.created_at);
      }
    });
    productCardMessages.forEach(m => {
      if (!convFirstProduct[m.conversation_id]) {
        convFirstProduct[m.conversation_id] = new Date(m.created_at);
      }
    });
    Object.keys(convFirstProduct).forEach(convId => {
      if (convFirstMsg[convId]) {
        const diff = (convFirstProduct[convId] - convFirstMsg[convId]) / 1000; // seconds
        if (diff >= 0) msgToProductTimes.push(diff);
      }
    });
    if (msgToProductTimes.length > 0) {
      avgTimeBetweenSteps.messageToProduct = Math.round(msgToProductTimes.reduce((a, b) => a + b, 0) / msgToProductTimes.length);
    }

    // Product → Order time (using conversation_id link)
    const productToOrderTimes = [];
    const orderConvIds = new Map();
    allOrders.forEach(o => {
      if (o.conversation_id && !orderConvIds.has(o.conversation_id)) {
        orderConvIds.set(o.conversation_id, new Date(o.created_at));
      }
    });
    Object.keys(convFirstProduct).forEach(convId => {
      if (orderConvIds.has(convId)) {
        const diff = (orderConvIds.get(convId) - convFirstProduct[convId]) / 1000;
        if (diff >= 0) productToOrderTimes.push(diff);
      }
    });
    if (productToOrderTimes.length > 0) {
      avgTimeBetweenSteps.productToOrder = Math.round(productToOrderTimes.reduce((a, b) => a + b, 0) / productToOrderTimes.length);
    }

    // ─── Funnel by Channel ───
    const channels = ["instagram", "facebook", "whatsapp"];
    const funnelByChannel = {};
    channels.forEach(ch => {
      const chConvs = allConversations.filter(c => c.channel === ch);
      const chConvIds = new Set(chConvs.map(c => c.id));
      const chIncomingMsgs = incomingMessages.filter(m => chConvIds.has(m.conversation_id));
      const chProductMsgs = productCardMessages.filter(m => chConvIds.has(m.conversation_id));
      const chOrders = allOrders.filter(o => o.channel === ch);
      const chPaidOrders = chOrders.filter(o => o.payment_status === "paid");

      funnelByChannel[ch] = {
        messages: chIncomingMsgs.length,
        conversations: chConvs.length,
        productsSent: chProductMsgs.length,
        ordersCreated: chOrders.length,
        ordersPaid: chPaidOrders.length,
      };
    });

    // ─── Funnel Over Time (weekly buckets) ───
    const funnelOverTime = [];
    const weeksToShow = range === "7d" ? 1 : range === "90d" ? 12 : range === "all" ? 12 : 4;
    for (let i = weeksToShow - 1; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekLabel = `Week ${weeksToShow - i}`;

      const weekConvs = allConversations.filter(c => {
        const d = new Date(c.created_at);
        return d >= weekStart && d < weekEnd;
      });
      const weekOrders = allOrders.filter(o => {
        const d = new Date(o.created_at);
        return d >= weekStart && d < weekEnd;
      });
      const weekPaid = weekOrders.filter(o => o.payment_status === "paid");

      funnelOverTime.push({
        label: weekLabel,
        conversations: weekConvs.length,
        orders: weekOrders.length,
        paid: weekPaid.length,
        conversionRate: weekConvs.length > 0 ? ((weekPaid.length / weekConvs.length) * 100).toFixed(1) : 0,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        steps: {
          messages: step1,
          conversations: step2,
          productsSent: step3,
          ordersCreated: step4,
          ordersPaid: step5,
        },
        dropoff,
        conversion,
        avgTimeBetweenSteps,
        funnelByChannel,
        funnelOverTime,
      },
    });
  } catch (error) {
    console.error("Funnel analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

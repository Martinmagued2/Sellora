import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const webhookId = searchParams.get("webhook_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("webhook_deliveries")
      .select("*", { count: "exact" })
      .eq("account_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (webhookId) {
      query = query.eq("webhook_id", webhookId);
    }
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo);
    }

    const { data: deliveries, error, count } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Also fetch webhook info for display
    const webhookIds = [...new Set((deliveries || []).map(d => d.webhook_id).filter(Boolean))];
    let webhooksMap = {};
    if (webhookIds.length > 0) {
      const { data: webhooks } = await supabase
        .from("account_webhooks")
        .select("id, url, events")
        .in("id", webhookIds);
      (webhooks || []).forEach(wh => {
        webhooksMap[wh.id] = wh;
      });
    }

    return Response.json({
      success: true,
      deliveries: (deliveries || []).map(d => ({
        ...d,
        webhook: webhooksMap[d.webhook_id] || null,
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error("Webhook deliveries list error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

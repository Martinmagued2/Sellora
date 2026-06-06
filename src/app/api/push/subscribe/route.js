import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint, keys } = await request.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({ error: "Missing subscription data" }, { status: 400 });
    }

    // Check if this endpoint already exists for this user
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("account_id", user.id)
      .eq("endpoint", endpoint)
      .single();

    if (existing) {
      // Update existing subscription
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ p256dh: keys.p256dh, auth: keys.auth })
        .eq("id", existing.id);

      if (error) {
        console.error("Failed to update push subscription:", error);
        return Response.json({ error: "Failed to update subscription" }, { status: 500 });
      }

      return Response.json({ success: true, updated: true });
    }

    // Create new subscription
    const { error } = await supabase
      .from("push_subscriptions")
      .insert({
        account_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

    if (error) {
      console.error("Failed to save push subscription:", error);
      return Response.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return Response.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}

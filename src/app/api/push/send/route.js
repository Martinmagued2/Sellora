/**
 * Push Send API
 * POST /api/push/send
 *
 * Sends a web push notification to all subscribed devices for the
 * authenticated user. Uses the web-push library with real VAPID keys.
 *
 * Body: { title, body, url?, icon? }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { broadcastPushToAccount } from "@/lib/push/web-push";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, body, url, icon, tag } = await req.json();
    if (!title || !body) {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const result = await broadcastPushToAccount(admin, user.id, {
      title, body, url, icon, tag,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUSH-SEND] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

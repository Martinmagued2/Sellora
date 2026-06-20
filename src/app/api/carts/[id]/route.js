/**
 * Cart by ID API
 * GET /api/carts/[id] — fetch a cart by ID (must belong to authenticated user)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

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

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const admin = getAdminClient();

    const { data: cart, error } = await admin
      .from("carts")
      .select("*")
      .eq("id", id)
      .eq("account_id", user.id)
      .single();

    if (error || !cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    return NextResponse.json({ cart });
  } catch (err) {
    console.error("[CART] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

/**
 * GET /api/paymob/order-status?orderId=xxx
 *
 * Returns order payment status. Requires authentication.
 * Only returns limited order info for security.
 */
export async function GET(request) {
  try {
    // 🔒 SECURITY: Require authentication to prevent order enumeration
    let authedUserId = null;
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
      if (!authError && user) {
        authedUserId = user.id;
      }
    } catch (e) {
      // No auth cookies
    }

    if (!authedUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 🔒 SECURITY: Only return orders belonging to the authenticated user's account
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, items, total, currency, payment_status, payment_method, account_id")
      .eq("id", orderId)
      .eq("account_id", authedUserId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Remove account_id from response
    const { account_id, ...orderData } = order;

    return NextResponse.json({ order: orderData });

  } catch (err) {
    console.error("[ORDER-STATUS] Error:", err);
    // 🔒 SECURITY: Don't leak internal error messages
    return NextResponse.json({ error: "Failed to retrieve order status" }, { status: 500 });
  }
}

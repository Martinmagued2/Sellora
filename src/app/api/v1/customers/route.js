/** GET /api/v1/customers — List customers (requires API key) */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateApiKey } from "@/lib/api-auth";

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  const auth = await authenticateApiKey(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const search = searchParams.get("search");

  const db = admin();
  let query = db.from("customers")
    .select("id, name, email, phone, channel, total_orders, total_spent, last_active_at, lifecycle_stage, tags")
    .eq("account_id", auth.accountId)
    .order("total_spent", { ascending: false })
    .limit(limit);

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customers: data || [], count: data?.length || 0 });
}

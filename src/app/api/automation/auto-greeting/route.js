import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
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
 * GET /api/automation/auto-greeting - Returns auto-greeting settings
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
    const { data: account } = await supabase
      .from("accounts")
      .select("auto_greeting, auto_greeting_message, business_name, instagram_greeting, facebook_greeting, whatsapp_greeting, greeting_delay_seconds, greeting_per_channel")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      autoGreeting: account?.auto_greeting || false,
      autoGreetingMessage: account?.auto_greeting_message || 'Hi! Welcome to {business_name} 👋 How can I help you today?',
      instagramGreeting: account?.instagram_greeting || '',
      facebookGreeting: account?.facebook_greeting || '',
      whatsappGreeting: account?.whatsapp_greeting || '',
      greetingDelaySeconds: account?.greeting_delay_seconds || 0,
      greetingPerChannel: account?.greeting_per_channel || false,
      businessName: account?.business_name || '',
    });
  } catch (error) {
    console.error("Auto-greeting GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/automation/auto-greeting - Update auto-greeting settings
 * Body: { auto_greeting?, auto_greeting_message?, instagram_greeting?, facebook_greeting?, whatsapp_greeting?, greeting_delay_seconds?, greeting_per_channel? }
 */
export async function PUT(req) {
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

    const body = await req.json();
    const { auto_greeting, auto_greeting_message, instagram_greeting, facebook_greeting, whatsapp_greeting, greeting_delay_seconds, greeting_per_channel } = body;

    const supabase = getSupabase();
    const updates = {};
    if (auto_greeting !== undefined) updates.auto_greeting = auto_greeting;
    if (auto_greeting_message !== undefined) updates.auto_greeting_message = auto_greeting_message;
    if (instagram_greeting !== undefined) updates.instagram_greeting = instagram_greeting;
    if (facebook_greeting !== undefined) updates.facebook_greeting = facebook_greeting;
    if (whatsapp_greeting !== undefined) updates.whatsapp_greeting = whatsapp_greeting;
    if (greeting_delay_seconds !== undefined) updates.greeting_delay_seconds = greeting_delay_seconds;
    if (greeting_per_channel !== undefined) updates.greeting_per_channel = greeting_per_channel;

    const { error } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to update auto-greeting settings" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auto-greeting PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

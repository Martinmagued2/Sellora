/**
 * GET /api/live-chat/widget — public endpoint that returns widget config for embedding.
 * POST /api/live-chat/widget — receive a message from the embedded widget.
 *
 * SECURITY:
 * - GET is intentionally public (returns business name + logo only — no sensitive data)
 * - POST is public BUT rate-limited by IP + visitor_id to prevent abuse
 * - Account must have live_chat_enabled = true to receive messages
 * - Message length capped at 2000 chars; customer_name capped at 100 chars
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) _adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}

/**
 * Simple in-memory rate limiter for live chat widget.
 * Limits: 10 messages per IP per 5 minutes, 30 per visitor_id per hour.
 * NOTE: In serverless (Vercel), this resets on cold starts. For true
 * distributed rate limiting, migrate to Upstash Redis.
 */
const ipHits = new Map();   // ip → [{ ts }]
const visitorHits = new Map();  // visitor_id → [{ ts }]
const WINDOW_5MIN = 5 * 60 * 1000;
const WINDOW_1HOUR = 60 * 60 * 1000;
const MAX_PER_IP_5MIN = 10;
const MAX_PER_VISITOR_1HOUR = 30;

function isRateLimited(key, map, windowMs, maxHits) {
  const now = Date.now();
  const hits = (map.get(key) || []).filter(ts => now - ts < windowMs);
  if (hits.length >= maxHits) return true;
  hits.push(now);
  map.set(key, hits);
  // Cleanup old entries periodically
  if (map.size > 10000) {
    for (const [k, v] of map) {
      const fresh = v.filter(ts => now - ts < windowMs);
      if (fresh.length === 0) map.delete(k);
      else map.set(k, fresh);
    }
  }
  return false;
}

function getClientIP(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id");
    if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

    const admin = getAdminClient();
    const { data: account } = await admin.from("accounts")
      .select("id, business_name, logo_url, ai_personality, live_chat_enabled")
      .eq("id", accountId).single();
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // Don't expose widget config if live chat is disabled
    if (account.live_chat_enabled === false) {
      return NextResponse.json({ error: "Live chat not enabled" }, { status: 403 });
    }

    return NextResponse.json({
      businessName: account.business_name,
      logoUrl: account.logo_url,
      welcomeMessage: "Hi! How can we help you today?",
      personality: account.ai_personality,
    });
  } catch (e) {
    console.error("[LIVE-CHAT-GET] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const ip = getClientIP(req);

    // Rate limit by IP
    if (isRateLimited(ip, ipHits, WINDOW_5MIN, MAX_PER_IP_5MIN)) {
      return NextResponse.json(
        { error: "Too many messages from this IP. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { account_id, visitor_id, message, customer_name, customer_email } = body;
    if (!account_id || !message) {
      return NextResponse.json({ error: "account_id and message required" }, { status: 400 });
    }

    // Validate message length
    const trimmedMessage = String(message).trim().slice(0, 2000);
    if (!trimmedMessage) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }
    const trimmedName = String(customer_name || "Website Visitor").trim().slice(0, 100);
    const trimmedEmail = customer_email ? String(customer_email).trim().slice(0, 200) : null;

    // Basic email format check
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Rate limit by visitor_id if provided
    if (visitor_id) {
      if (isRateLimited(visitor_id, visitorHits, WINDOW_1HOUR, MAX_PER_VISITOR_1HOUR)) {
        return NextResponse.json(
          { error: "Too many messages from this visitor. Please try again later." },
          { status: 429 }
        );
      }
    }

    const admin = getAdminClient();

    // Verify the account exists and has live chat enabled
    const { data: account } = await admin.from("accounts")
      .select("id, live_chat_enabled")
      .eq("id", account_id)
      .maybeSingle();
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (account.live_chat_enabled === false) {
      return NextResponse.json({ error: "Live chat not enabled for this account" }, { status: 403 });
    }

    // Find or create a live chat session
    let session;
    if (visitor_id) {
      const { data: existing } = await admin.from("live_chat_sessions")
        .select("*").eq("account_id", account_id).eq("visitor_id", visitor_id).eq("status", "open").maybeSingle();
      session = existing;
    }

    if (!session) {
      // Create new session + customer
      const { data: customer } = await admin.from("customers").insert({
        account_id, name: trimmedName, email: trimmedEmail, channel: "manual",
      }).select("*").single();

      const { data: conv } = await admin.from("conversations").insert({
        account_id: account_id, customer_id: customer.id, channel: "manual", status: "new",
      }).select("*").single();

      const { data: newSession } = await admin.from("live_chat_sessions").insert({
        account_id, customer_id: customer.id, customer_name: trimmedName, customer_email: trimmedEmail, visitor_id: visitor_id || crypto.randomUUID(),
        status: "open", last_message_at: new Date().toISOString(),
      }).select("*").single();
      session = { ...newSession, conversation_id: conv.id, customer_id: customer.id };
    } else {
      await admin.from("live_chat_sessions").update({ last_message_at: new Date().toISOString() }).eq("id", session.id);
    }

    // Store the message
    await admin.from("messages").insert({
      conversation_id: session.conversation_id || session.id,
      account_id, direction: "incoming", content: trimmedMessage, type: "text", is_ai: false,
    });

    return NextResponse.json({ success: true, sessionId: session.id, visitorId: session.visitor_id });
  } catch (e) {
    console.error("[LIVE-CHAT-POST] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

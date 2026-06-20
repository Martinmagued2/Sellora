/**
 * Token Exchange — exchange short-lived token for long-lived (60 days)
 * POST /api/auth/token-exchange
 *
 * Meta Page Access Tokens expire. This endpoint exchanges a
 * short-lived token for a long-lived one (60 days) that auto-refreshes.
 *
 * Body: { shortLivedToken }
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { shortLivedToken } = await req.json();
    if (!shortLivedToken) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return NextResponse.json({ error: "App not configured" }, { status: 500 });

    // Exchange short-lived → long-lived
    const res = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${appId}&` +
      `client_secret=${appSecret}&` +
      `fb_exchange_token=${shortLivedToken}`
    );
    const data = await res.json();

    if (!data.access_token) {
      return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
    }

    return NextResponse.json({
      longLivedToken: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

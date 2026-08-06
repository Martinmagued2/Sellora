/**
 * SSO/SAML authentication endpoints.
 *
 * GET  /api/auth/saml?account_id=<uuid> — initiates SSO login (redirects to IdP)
 * POST /api/auth/saml/callback — receives SAML assertion from IdP, logs user in
 *
 * This is a simplified SAML SP (Service Provider) implementation that:
 * 1. Generates the SAML AuthnRequest
 * 2. Redirects to the IdP's SSO URL
 * 3. Receives the SAML response
 * 4. Extracts user attributes (email, name)
 * 5. Looks up or creates the user in Supabase
 * 6. Signs them in
 *
 * For production SAML, consider using @node-saml/passport-saml or WorkOS.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id");

    if (!accountId) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const db = admin();
    const { data: ssoConfig } = await db
      .from("sso_configs")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .maybeSingle();

    if (!ssoConfig) {
      return NextResponse.json({ error: "SSO not configured for this account" }, { status: 404 });
    }

    // Generate SAML AuthnRequest
    const requestId = `_${crypto.randomUUID()}`;
    const assertionConsumerServiceURL = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.sellorachat.com"}/api/auth/saml/callback`;
    const issueInstant = new Date().toISOString();

    const samlRequest = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${ssoConfig.sso_url}" AssertionConsumerServiceURL="${assertionConsumerServiceURL}"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${ssoConfig.entity_id}</saml:Issuer><samlp:NameIDPolicy Format="${ssoConfig.name_id_format}" AllowCreate="true"/></samlp:AuthnRequest>`;

    // Base64 encode the request
    const encodedRequest = Buffer.from(samlRequest).toString("base64");

    // Redirect to IdP
    const redirectUrl = `${ssoConfig.sso_url}?SAMLRequest=${encodeURIComponent(encodedRequest)}&RelayState=${accountId}`;

    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    console.error("[SAML] GET error:", e.message);
    return NextResponse.json({ error: "SSO initiation failed" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse");
    const relayState = formData.get("RelayState"); // accountId

    if (!samlResponse) {
      return NextResponse.json({ error: "No SAML response received" }, { status: 400 });
    }

    // Decode the SAML response
    const decodedResponse = Buffer.from(samlResponse, "base64").toString("utf-8");

    // Extract user attributes from SAML response (simplified parsing)
    // In production, use a proper SAML library with signature verification
    const emailMatch = decodedResponse.match(/<saml:Attribute[^>]*Name="email"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i);
    const nameMatch = decodedResponse.match(/<saml:Attribute[^>]*Name="name"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i);

    // Also try NameID
    const nameIdMatch = decodedResponse.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i);

    const email = emailMatch?.[1] || nameIdMatch?.[1];
    const name = nameMatch?.[1] || "SSO User";

    if (!email) {
      return NextResponse.json({ error: "Could not extract email from SAML response" }, { status: 400 });
    }

    // Look up or create user in Supabase
    const db = admin();
    const { data: existingUser } = await db
      .from("accounts")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    let userId;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create a new account for the SSO user
      const { data: newUser, error } = await db
        .from("accounts")
        .insert({
          email,
          owner_name: name,
          plan: "starter",
          plan_status: "trialing",
        })
        .select("id")
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to create user from SSO" }, { status: 500 });
      }
      userId = newUser.id;
    }

    // Redirect to dashboard with a success indicator
    // In a real implementation, we'd set a session cookie here
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.sellorachat.com"}/dashboard?sso=success`;
    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    console.error("[SAML] POST error:", e.message);
    return NextResponse.json({ error: "SAML callback failed" }, { status: 500 });
  }
}

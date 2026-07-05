/** GET /api/debug/shopify-test — diagnose Shopify connection */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { decryptShopifyToken } from "@/lib/shopify";

let _admin = null;
function getAdmin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdmin();
    const { data: account } = await admin.from("accounts")
      .select("shopify_installed, shopify_shop_domain, shopify_access_token")
      .eq("id", user.id).single();

    if (!account?.shopify_installed) {
      return NextResponse.json({ error: "Shopify not connected", connected: false });
    }

    // Try to decrypt the token
    let token = null;
    let decryptError = null;
    try {
      token = decryptShopifyToken(account.shopify_access_token);
    } catch (e) {
      decryptError = e.message;
    }

    if (!token) {
      return NextResponse.json({
        connected: true,
        shop: account.shopify_shop_domain,
        tokenPresent: !!account.shopify_access_token,
        tokenLength: account.shopify_access_token?.length || 0,
        decryptError,
        envCheck: {
          SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? "SET" : "MISSING",
          SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? "SET" : "MISSING",
          SHOPIFY_TOKEN_ENCRYPTION_KEY: process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY ? "SET" : "MISSING (using API_SECRET as fallback)",
        },
        recommendation: decryptError
          ? "Token decryption failed. The SHOPIFY_API_SECRET may have changed since the token was encrypted. Disconnect and reconnect Shopify."
          : "Token is null. Disconnect and reconnect Shopify.",
      });
    }

    // Test the token against Shopify API
    const shop = account.shopify_shop_domain;
    const testRes = await fetch(`https://${shop}/admin/api/2024-04/shop.json`, {
      headers: { "X-Shopify-Access-Token": token },
    });

    const testStatus = testRes.status;
    let testBody = null;
    if (testRes.ok) {
      testBody = await testRes.json();
    } else {
      testBody = await testRes.text();
    }

    // Also test products endpoint
    const productsRes = await fetch(`https://${shop}/admin/api/2024-04/products.json?limit=1`, {
      headers: { "X-Shopify-Access-Token": token },
    });

    return NextResponse.json({
      connected: true,
      shop,
      tokenPresent: true,
      tokenLength: token.length,
      // 🔒 SECURITY: Removed tokenPrefix — leaking first 6 chars of an access token
      // aids brute-force attacks when combined with key-length info.
      shopInfo: testRes.ok ? { name: testBody.shop?.name, plan: testBody.shop?.plan_name } : null,
      shopApiStatus: testStatus,
      productsApiStatus: productsRes.status,
      productsError: !productsRes.ok ? (await productsRes.text()).substring(0, 300) : null,
      envCheck: {
        SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? "SET" : "MISSING",
        SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? "SET" : "MISSING",
      },
      recommendation: productsRes.status === 403
        ? "Token doesn't have read_products scope. Disconnect Shopify in Sellora, verify access scopes in Partner Dashboard (read_products,write_products,read_orders), then reconnect."
        : productsRes.ok
        ? "Everything looks good! Try syncing again."
        : `Products API returned ${productsRes.status}. Check the error above.`,
    });
  } catch (e) {
    // 🔒 SECURITY: Don't leak error message to client (could expose internal paths)
    console.error('[debug/shopify-test]', e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

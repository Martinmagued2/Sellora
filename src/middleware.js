import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, createRateLimitKey } from "@/lib/rate-limit";

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  // ─── White-Label Custom Domain Routing ───
  // If the request comes from a custom domain (not sellorachat.com),
  // look up the account by custom_domain and inject the account ID
  // as a header so downstream code can use it for branding.
  const hostname = request.headers.get("host") || "";
  const isMainDomain = hostname.includes("sellorachat.com") || hostname.includes("localhost") || hostname.includes("vercel.app");

  if (!isMainDomain) {
    // This is a custom domain — look up the account
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { data: account } = await supabase
        .from("accounts")
        .select("id, business_name, branding_primary_color, branding_logo_url, hide_sellora_branding, is_whitelabel")
        .eq("custom_domain", hostname)
        .maybeSingle();

      if (account) {
        // Inject branding info as headers for downstream use
        supabaseResponse.headers.set("x-whitelabel-account-id", account.id);
        supabaseResponse.headers.set("x-whitelabel-business-name", account.business_name || "");
        supabaseResponse.headers.set("x-whitelabel-primary-color", account.branding_primary_color || "#6c5ce7");
        supabaseResponse.headers.set("x-whitelabel-logo-url", account.branding_logo_url || "");
        supabaseResponse.headers.set("x-whitelabel-hide-branding", String(account.hide_sellora_branding || false));
      }
    } catch (e) {
      // Non-critical — continue without white-label headers
    }
  }

  // ─── Rate Limiting (applied to all matched routes) ───
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // Skip rate limiting for static assets and GET requests on non-sensitive pages
  if (method === "GET" && !pathname.startsWith("/api/")) {
    // No rate limit on regular page GETs
  } else {
    // Determine rate limit tier based on route
    let rateLimitTier = "api"; // default

    if (
      pathname.startsWith("/api/auth") ||
      pathname === "/login" && method === "POST" ||
      pathname === "/signup" && method === "POST" ||
      pathname === "/forgot-password" && method === "POST"
    ) {
      rateLimitTier = "auth";
    } else if (
      pathname.includes("/webhooks/") ||
      pathname.includes("/webhook")
    ) {
      rateLimitTier = "webhook";
    } else if (pathname.startsWith("/api/admin")) {
      rateLimitTier = "admin";
    } else if (
      pathname.includes("/email/test") ||
      pathname.includes("/email/weekly") ||
      pathname.includes("/notifications/email")
    ) {
      rateLimitTier = "email";
    }

    // Rate limit ALL API routes (GET and mutation)
    if (pathname.startsWith("/api/")) {
      // 🔒 SECURITY: Also rate-limit GET API endpoints (was only POST/PUT/DELETE/PATCH)
      // Use a more lenient tier for GET requests
      const getRlTier = method === "GET" ? "api_read" : rateLimitTier;
      const rlKey = createRateLimitKey(request);
      const rlResult = checkRateLimit(rlKey, getRlTier);

      if (rlResult.limited) {
        return rateLimitResponse(rlResult.resetAt);
      }

      // Add rate limit headers to the response
      supabaseResponse.headers.set("X-RateLimit-Remaining", String(rlResult.remaining));
      supabaseResponse.headers.set("X-RateLimit-Reset", String(Math.ceil(rlResult.resetAt / 1000)));
    }

    // SECURITY FIX: Also rate limit auth page POSTs (not just API routes)
    if (rateLimitTier === "auth" && method === "POST" && !pathname.startsWith("/api/")) {
      const rlKey = createRateLimitKey(request);
      const rlResult = checkRateLimit(rlKey, "auth");
      if (rlResult.limited) {
        return rateLimitResponse(rlResult.resetAt);
      }
    }
  }

  // Skip auth if Supabase is not configured
  // 🔒 SECURITY: Do NOT silently bypass auth — log a warning instead
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("[MIDDLEWARE] CRITICAL: Supabase env vars not set. Denying access to protected routes.");
    // For unprotected pages, let them through. For protected/admin routes, block.
    const protectedPaths = ["/dashboard", "/onboarding", "/admin"];
    if (protectedPaths.some((path) => pathname.startsWith(path))) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── Route classification ───
  const protectedPaths = ["/dashboard", "/onboarding"];
  const adminPaths = ["/admin"];
  const authPaths = ["/login", "/signup", "/forgot-password"];
  const twoFactorPath = "/auth/verify-2fa";

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAdminRoute = adminPaths.some((path) => pathname.startsWith(path));
  const isAuthPage = authPaths.some((path) => pathname.startsWith(path));
  const is2FAVerifyPage = pathname.startsWith(twoFactorPath);

  // ─── 1. Redirect unauthenticated users away from protected routes ───
  if ((isProtected || isAdminRoute) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─── 2. 2FA enforcement (SERVER-SIDE) ───
  // SECURITY FIX: Check 2FA status server-side instead of relying on sessionStorage
  if (user && isProtected && !is2FAVerifyPage) {
    try {
      const { data: account } = await supabase
        .from("accounts")
        .select("totp_enabled, two_factor_verified_at")
        .eq("id", user.id)
        .single();

      if (account?.totp_enabled) {
        // Check if 2FA has been verified recently (within last 12 hours)
        const verifiedAt = account.two_factor_verified_at;
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

        if (!verifiedAt || new Date(verifiedAt) < twelveHoursAgo) {
          // 2FA not verified or expired — redirect to verification page
          const verifyUrl = new URL("/auth/verify-2fa", request.url);
          verifyUrl.searchParams.set("redirectTo", pathname);
          return NextResponse.redirect(verifyUrl);
        }
      }
    } catch (err) {
      // Gracefully handle errors (column may not exist yet)
      console.warn("[MIDDLEWARE] 2FA check failed:", err.message);
    }
  }

  // ─── 3. Admin route enforcement ───
  // Check the user's role from the accounts table in DB
  if (isAdminRoute && user) {
    try {
      const { data: account, error: roleError } = await supabase
        .from("accounts")
        .select("role")
        .eq("id", user.id)
        .single();

      // If role column doesn't exist yet (migration not run), deny admin access gracefully
      if (roleError) {
        console.warn("[MIDDLEWARE] Could not check admin role — column may not exist yet:", roleError.message);
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      if (!account || account.role !== "admin") {
        // Non-admin trying to access admin area → redirect to dashboard
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch (err) {
      // Gracefully handle any DB errors (missing column, connection issues, etc.)
      console.error("[MIDDLEWARE] Admin check failed:", err.message);
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ─── 4. Redirect authenticated users away from auth pages ───
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ─── 5. Redirect away from 2FA verify page if not needed ───
  if (is2FAVerifyPage && user) {
    try {
      const { data: account } = await supabase
        .from("accounts")
        .select("totp_enabled, two_factor_verified_at")
        .eq("id", user.id)
        .single();

      if (!account?.totp_enabled) {
        // 2FA not enabled, redirect to dashboard
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      const verifiedAt = account.two_factor_verified_at;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      if (verifiedAt && new Date(verifiedAt) >= twelveHoursAgo) {
        // 2FA already verified, redirect to intended page
        const redirectTo = request.nextUrl.searchParams.get("redirectTo") || "/dashboard";
        // SECURITY: Validate redirectTo is a relative path
        if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
          return NextResponse.redirect(new URL(redirectTo, request.url));
        }
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

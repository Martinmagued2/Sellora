import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, createRateLimitKey } from "@/lib/rate-limit";

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

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

    // Only rate limit POST/PUT/DELETE/PATCH on API routes
    if (pathname.startsWith("/api/") && method !== "GET") {
      const rlKey = createRateLimitKey(request);
      const rlResult = checkRateLimit(rlKey, rateLimitTier);

      if (rlResult.limited) {
        return rateLimitResponse(rlResult.resetAt);
      }

      // Add rate limit headers to the response
      supabaseResponse.headers.set("X-RateLimit-Remaining", String(rlResult.remaining));
      supabaseResponse.headers.set("X-RateLimit-Reset", String(Math.ceil(rlResult.resetAt / 1000)));
    }
  }

  // Skip auth if Supabase is not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
  // (pathname already declared at top — reused here)

  const protectedPaths = ["/dashboard", "/onboarding"];
  const adminPaths = ["/admin"];
  const authPaths = ["/login", "/signup", "/forgot-password"];

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAdminRoute = adminPaths.some((path) => pathname.startsWith(path));
  const isAuthPage = authPaths.some((path) => pathname.startsWith(path));

  // ─── 1. Redirect unauthenticated users away from protected routes ───
  if ((isProtected || isAdminRoute) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─── 2. Admin route enforcement ───
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

  // ─── 3. Redirect authenticated users away from auth pages ───
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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

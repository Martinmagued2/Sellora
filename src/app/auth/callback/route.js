import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const ALLOWED_REDIRECTS = [
    "/dashboard",
    "/dashboard/analytics",
    "/dashboard/customers",
    "/dashboard/conversations",
    "/settings",
  ];
  const nextBase = rawNext.split("?")[0].split("#")[0];
  const next = ALLOWED_REDIRECTS.includes(nextBase) ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();

    // 1. Exchange code
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // 2. Get user (already returned from exchangeCodeForSession as data.user)

      // 3. Check account
      const { data: existingAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", data.user.id)
        .single();

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      const getRedirectUrl = (path) => {
        if (isLocalEnv) return `${origin}${path}`;
        if (forwardedHost) return `https://${forwardedHost}${path}`;
        return `${origin}${path}`;
      };

      // Helper to clear the referral cookie
      const getClearCookieHeader = (path) => {
        const redirectUrl = getRedirectUrl(path);
        return [
          `sellora_ref_code=; path=/; max-age=0; SameSite=Lax`,
        ];
      };

      if (!existingAccount) {
        // 4. If new: Create account
        await supabase.from("accounts").insert({
          id: data.user.id,
          email: data.user.email,
          business_name: data.user.user_metadata?.full_name || "My Store",
          owner_name: data.user.user_metadata?.full_name || "",
          plan: "starter",
          plan_status: "trialing",
        });

        // Send welcome email (fire-and-forget, don't block redirect)
        sendWelcomeEmail({
          to: data.user.email,
          fullName: data.user.user_metadata?.full_name || data.user.email,
          businessName: data.user.user_metadata?.business_name || "My Store",
        }).catch(err => console.warn("[AUTH] Welcome email failed:", err.message));

        // Track referral from cookie (set before Google OAuth redirect)
        const refCookie = request.cookies.get("sellora_ref_code")?.value;
        if (refCookie) {
          try {
            const adminModule = await import("@supabase/supabase-js");
            const adminClient = adminModule.createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL,
              process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            await adminClient.from("referrals").insert({
              referrer_id: (await adminClient.from("accounts").select("id").eq("referral_code", refCookie).single()).data?.id,
              referral_code: refCookie,
              referred_email: data.user.email,
              referred_id: data.user.id,
              status: "signed_up",
              commission_earned: 5.00,
              commission_paid: 0,
            });

            // Award credits to referrer
            const { data: referrer } = await adminClient
              .from("accounts")
              .select("id, referral_credits")
              .eq("referral_code", refCookie)
              .single();

            if (referrer) {
              const newCredits = (parseFloat(referrer.referral_credits) || 0) + 5.00;
              await adminClient
                .from("accounts")
                .update({ referral_credits: newCredits })
                .eq("id", referrer.id);
            }
          } catch (refErr) {
            console.warn("[AUTH] Failed to track referral from cookie:", refErr.message);
          }
        }

        // Redirect -> onboarding, clear referral cookie
        const response = NextResponse.redirect(getRedirectUrl("/onboarding"));
        response.cookies.set("sellora_ref_code", "", { path: "/", maxAge: 0 });
        return response;
      } else {
        // 5. Else: Redirect -> dashboard, clear referral cookie
        const response = NextResponse.redirect(getRedirectUrl(next));
        response.cookies.set("sellora_ref_code", "", { path: "/", maxAge: 0 });
        return response;
      }
    }
  }

  // Auth code exchange failed — redirect to error page
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}

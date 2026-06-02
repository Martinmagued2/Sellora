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

      if (!existingAccount) {
        // 4. If new: Create account
        // Assuming your DB allows this or you will alter it to support onboarding_status
        await supabase.from("accounts").insert({
          id: data.user.id,
          email: data.user.email,
          business_name: data.user.user_metadata?.full_name || "My Store",
          owner_name: data.user.user_metadata?.full_name || "",
          plan: "starter",
          plan_status: "trialing",
          // Add onboarding flag (needs to exist in DB schema, ignored by supabase if column not found but good practice)
        });
        
        // Send welcome email (fire-and-forget, don't block redirect)
        sendWelcomeEmail({
          to: data.user.email,
          fullName: data.user.user_metadata?.full_name || data.user.email,
          businessName: data.user.user_metadata?.business_name || "My Store",
        }).catch(err => console.warn("[AUTH] Welcome email failed:", err.message));
        
        // (optional) seed data - could be added here
        
        // Redirect -> onboarding
        return NextResponse.redirect(getRedirectUrl("/onboarding"));
      } else {
        // 5. Else: Redirect -> dashboard
        return NextResponse.redirect(getRedirectUrl(next));
      }
    }
  }

  // Auth code exchange failed — redirect to error page
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}

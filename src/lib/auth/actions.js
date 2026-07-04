"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";
import { isRateLimited } from "@/lib/rate-limit";

// In-memory rate limit for server actions (per-email tracking)
const authAttempts = new Map();

function checkAuthRateLimit(email, action = "login") {
  const key = `${action}:${email}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const record = authAttempts.get(key);
  if (!record) {
    authAttempts.set(key, { count: 1, startTime: now });
    return false;
  }

  if (now - record.startTime > windowMs) {
    authAttempts.set(key, { count: 1, startTime: now });
    return false;
  }

  record.count += 1;
  if (record.count > maxAttempts) {
    return true; // Rate limited
  }
  return false;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of authAttempts.entries()) {
    if (now - record.startTime > 15 * 60 * 1000) {
      authAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function login(formData) {
  const supabase = await createClient();
  const email = formData.get("email");

  // Rate limit check — max 5 attempts per email per 15 minutes
  if (checkAuthRateLimit(email, "login")) {
    return { error: "Too many login attempts. Please try again in 15 minutes." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: formData.get("password"),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData) {
  const supabase = await createClient();

  const email = formData.get("email");
  const password = formData.get("password");
  const fullName = formData.get("fullName");
  const businessName = formData.get("businessName");

  // Rate limit check — max 5 signup attempts per email per 15 minutes
  if (checkAuthRateLimit(email, "signup")) {
    return { error: "Too many signup attempts. Please try again in 15 minutes." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        business_name: businessName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Create the account record in our accounts table
  if (data.user) {
    const { error: accountError } = await supabase.from("accounts").insert({
      id: data.user.id,
      email: email,
      business_name: businessName,
      owner_name: fullName,
      plan: "starter",
      plan_status: "trialing",
      ai_enabled: true, // Explicitly enable AI auto-reply for new accounts
    });

    if (accountError) {
      console.error("Error creating account:", accountError);
    }

    // Send welcome email (fire-and-forget, don't block signup flow)
    sendWelcomeEmail({
      to: email,
      fullName: fullName || email,
      businessName: businessName || "My Store",
    }).catch(err => console.warn("[SIGNUP] Welcome email failed:", err.message));
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function loginWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function resetPassword(formData) {
  const supabase = await createClient();
  const email = formData.get("email");

  // SECURITY FIX: Never trust client-supplied origin.
  // Always use the server-side environment variable for redirect URLs.
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!email) return { error: "Email is required" };

  // In-memory rate limit — max 5 per 15 minutes (first line of defense)
  if (checkAuthRateLimit(email, "reset")) {
    return { error: "Too many reset requests. Please try again in 15 minutes." };
  }

  // 1. Bypass RLS using the admin client to check and log rate limits securely
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 2. Check 1-hour rate limit (max 3)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count } = await adminClient
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("email", email)
    .eq("action", "password_reset")
    .gte("created_at", oneHourAgo);

  if (count >= 3) {
    return { error: "Too many reset requests. Please try again later." };
  }

  // 3. Log the new request attempt
  await adminClient.from("rate_limits").insert({ email, action: "password_reset" });

  // 4. Proceed with standard reset via user's client
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

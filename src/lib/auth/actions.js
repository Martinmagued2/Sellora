"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email"),
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
      // Add onboarding flag
    });

    if (accountError) {
      console.error("Error creating account:", accountError);
    }
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
  const origin = formData.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!email) return { error: "Email is required" };

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

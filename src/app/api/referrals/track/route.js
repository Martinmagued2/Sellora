import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { referralCode, referredEmail, referredId } = await request.json();

    if (!referralCode) {
      return Response.json({ error: "Referral code is required" }, { status: 400 });
    }

    // 🔒 SECURITY: When `referredId` is provided (which triggers $5 credit award),
    // require authentication AND verify the authenticated user matches referredId.
    // This prevents attackers from spamming fake referrals to credit any account.
    if (referredId) {
      const authUser = await getAuthUser(request);
      if (!authUser) {
        return Response.json({ error: "Authentication required to award referral credits" }, { status: 401 });
      }
      if (authUser.id !== referredId) {
        return Response.json({ error: "referredId must match the authenticated user" }, { status: 403 });
      }

      // 🔒 Rate limit: 1 referral credit claim per IP per hour (per-user already enforced above)
      const ip = getClientIp(request);
      const rlKey = `referral-track:${ip}`;
      if (checkRateLimit(rlKey, 3, 60 * 60 * 1000).limited) {
        return Response.json({ error: "Too many referral attempts. Please try again later." }, { status: 429 });
      }
    } else {
      // Anonymous tracking (click tracking before signup) — apply IP rate limit
      const ip = getClientIp(request);
      const rlKey = `referral-track-anon:${ip}`;
      if (checkRateLimit(rlKey, 10, 60 * 60 * 1000).limited) {
        return Response.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    const supabase = await createClient();
    const adminClient = getAdminClient();

    // Find the referrer by code
    const { data: referrerAccount } = await adminClient
      .from("accounts")
      .select("id, referral_code")
      .eq("referral_code", referralCode)
      .single();

    if (!referrerAccount) {
      return Response.json({ error: "Invalid referral code" }, { status: 404 });
    }

    // Prevent self-referral
    if (referredId && referredId === referrerAccount.id) {
      return Response.json({ error: "Self-referral is not allowed" }, { status: 400 });
    }

    // 🔒 SECURITY: Dedupe on BOTH referred_email AND referred_id (not just email)
    // Previously an attacker could rotate emails to bypass the dedupe.
    if (referredId) {
      const { data: existingById } = await adminClient
        .from("referrals")
        .select("id")
        .eq("referrer_id", referrerAccount.id)
        .eq("referred_id", referredId)
        .maybeSingle();

      if (existingById) {
        return Response.json({ message: "Already referred", referralId: existingById.id });
      }
    }

    if (referredEmail) {
      const { data: existing } = await adminClient
        .from("referrals")
        .select("id")
        .eq("referrer_id", referrerAccount.id)
        .eq("referred_email", referredEmail)
        .maybeSingle();

      if (existing) {
        return Response.json({ message: "Already referred", referralId: existing.id });
      }
    }

    // Create the referral record
    const referralData = {
      referrer_id: referrerAccount.id,
      referral_code: referralCode,
      referred_email: referredEmail || null,
      referred_id: referredId || null,
      status: referredId ? "signed_up" : "pending",
      commission_earned: 0,
      commission_paid: 0,
    };

    const { data: referral, error } = await adminClient
      .from("referrals")
      .insert(referralData)
      .select()
      .single();

    if (error) {
      // 23505 = unique violation — already referred
      if (error.code === "23505") {
        return Response.json({ message: "Already referred" });
      }
      console.error("Failed to create referral:", error);
      return Response.json({ error: "Failed to track referral" }, { status: 500 });
    }

    // If the user signed up, award referral credits to the referrer
    if (referredId) {
      const SIGNUP_BONUS = 5.00;

      // Try the RPC function first
      const { error: rpcError } = await adminClient.rpc("increment_referral_credits", {
        p_account_id: referrerAccount.id,
        p_amount: SIGNUP_BONUS,
      });

      if (rpcError) {
        console.warn("RPC increment_referral_credits failed, using fallback:", rpcError.message);
        // Fallback: read current credits and update
        const { data: currentAccount } = await adminClient
          .from("accounts")
          .select("referral_credits")
          .eq("id", referrerAccount.id)
          .single();

        const currentCredits = parseFloat(currentAccount?.referral_credits) || 0;
        await adminClient
          .from("accounts")
          .update({ referral_credits: currentCredits + SIGNUP_BONUS })
          .eq("id", referrerAccount.id);
      }

      // Update the referral record with the commission
      await adminClient
        .from("referrals")
        .update({
          status: "signed_up",
          commission_earned: SIGNUP_BONUS,
        })
        .eq("id", referral.id);
    }

    return Response.json({ success: true, referralId: referral.id });
  } catch (err) {
    console.error("Referrals track error:", err);
    return Response.json({ error: "Failed to track referral" }, { status: 500 });
  }
}

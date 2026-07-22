import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    // SECURITY: Require authentication. Previously this endpoint was
    // unauthenticated — anyone could mint $5 referral credits by repeatedly
    // POSTing with different `referredId` UUIDs.
    const user = await getAuthUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { referralCode } = await request.json();

    if (!referralCode) {
      return Response.json({ error: "Referral code is required" }, { status: 400 });
    }

    // SECURITY: Use the authenticated user's ID as referredId.
    // Do NOT accept referredId from the request body.
    const referredId = user.id;
    const referredEmail = user.email;

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

    // Check if this email was already referred by this person
    if (referredEmail) {
      const { data: existing } = await adminClient
        .from("referrals")
        .select("id")
        .eq("referrer_id", referrerAccount.id)
        .eq("referred_email", referredEmail)
        .single();

      if (existing) {
        return Response.json({ message: "Already referred", referralId: existing.id });
      }
    }

    // SECURITY: Also dedupe by referred_id — prevents the same user from
    // being referred multiple times (which would multiply the credit award).
    if (referredId) {
      const { data: existingById } = await adminClient
        .from("referrals")
        .select("id, referrer_id")
        .eq("referred_id", referredId)
        .maybeSingle();

      if (existingById) {
        // Already referred (by this or another referrer) — return without re-awarding
        return Response.json({
          message: "User already referred",
          referralId: existingById.id,
          alreadyReferred: true,
        });
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

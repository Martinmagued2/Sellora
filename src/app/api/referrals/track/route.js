import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const { referralCode, referredEmail, referredId } = await request.json();

    if (!referralCode) {
      return Response.json({ error: "Referral code is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Find the referrer by code
    const { data: referrerAccount } = await supabase
      .from("accounts")
      .select("id, referral_code")
      .eq("referral_code", referralCode)
      .single();

    if (!referrerAccount) {
      return Response.json({ error: "Invalid referral code" }, { status: 404 });
    }

    // Check if this email was already referred by this person
    if (referredEmail) {
      const { data: existing } = await supabase
        .from("referrals")
        .select("id")
        .eq("referrer_id", referrerAccount.id)
        .eq("referred_email", referredEmail)
        .single();

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

    const { data: referral, error } = await supabase
      .from("referrals")
      .insert(referralData)
      .select()
      .single();

    if (error) {
      console.error("Failed to create referral:", error);
      return Response.json({ error: "Failed to track referral" }, { status: 500 });
    }

    // If the user signed up, update status and add credits
    if (referredId) {
      await supabase
        .from("referrals")
        .update({ status: "signed_up" })
        .eq("id", referral.id);

      // Award referral credits to the referrer
      const SIGNUP_BONUS = 5.00;
      await supabase.rpc("increment_referral_credits", {
        p_account_id: referrerAccount.id,
        p_amount: SIGNUP_BONUS,
      }).catch(() => {
        // Fallback if RPC doesn't exist
        supabase
          .from("accounts")
          .update({
            referral_credits: supabase.raw?.("referral_credits + " + SIGNUP_BONUS) || 0,
          })
          .eq("id", referrerAccount.id);
      });
    }

    return Response.json({ success: true, referralId: referral.id });
  } catch (err) {
    console.error("Referrals track error:", err);
    return Response.json({ error: "Failed to track referral" }, { status: 500 });
  }
}

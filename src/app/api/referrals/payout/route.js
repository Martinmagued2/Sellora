import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    // Get user's account with referral credits
    const { data: account } = await adminClient
      .from("accounts")
      .select("id, referral_credits")
      .eq("id", user.id)
      .single();

    if (!account) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const availableCredits = parseFloat(account.referral_credits) || 0;

    // Check minimum payout amount
    if (availableCredits < 10) {
      return Response.json({
        error: "Minimum payout amount is $10.00",
        available: availableCredits,
      }, { status: 400 });
    }

    // Check if there's already a pending payout request
    const { data: pendingPayouts } = await adminClient
      .from("referral_payouts")
      .select("id")
      .eq("account_id", user.id)
      .eq("status", "pending");

    if (pendingPayouts && pendingPayouts.length > 0) {
      return Response.json({
        error: "You already have a pending payout request. Please wait for it to be processed.",
      }, { status: 400 });
    }

    // Create the payout request
    const { data: payout, error: payoutError } = await adminClient
      .from("referral_payouts")
      .insert({
        account_id: user.id,
        amount: availableCredits,
        status: "pending",
      })
      .select()
      .single();

    if (payoutError) {
      console.error("Failed to create payout:", payoutError);
      return Response.json({ error: "Failed to create payout request" }, { status: 500 });
    }

    // Deduct the credits from the account (move to "processing" state)
    await adminClient
      .from("accounts")
      .update({ referral_credits: 0 })
      .eq("id", user.id);

    // Update referral records: mark earned commissions as paid
    const { data: unpaidReferrals } = await adminClient
      .from("referrals")
      .select("id, commission_earned, commission_paid")
      .eq("referrer_id", user.id)
      .gt("commission_earned", 0);

    if (unpaidReferrals && unpaidReferrals.length > 0) {
      for (const ref of unpaidReferrals) {
        const unpaid = parseFloat(ref.commission_earned) - parseFloat(ref.commission_paid);
        if (unpaid > 0) {
          await adminClient
            .from("referrals")
            .update({
              commission_paid: ref.commission_earned,
              status: "paid",
            })
            .eq("id", ref.id);
        }
      }
    }

    return Response.json({
      success: true,
      payout: {
        id: payout.id,
        amount: availableCredits,
        status: "pending",
        requestedAt: payout.requested_at,
      },
      message: "Payout request submitted! We'll process it within 3-5 business days.",
    });
  } catch (err) {
    console.error("Payout API error:", err);
    return Response.json({ error: "Failed to process payout request" }, { status: 500 });
  }
}

// GET: List payout history
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    const { data: payouts } = await adminClient
      .from("referral_payouts")
      .select("*")
      .eq("account_id", user.id)
      .order("requested_at", { ascending: false });

    return Response.json({ payouts: payouts || [] });
  } catch (err) {
    console.error("Payout history error:", err);
    return Response.json({ error: "Failed to fetch payout history" }, { status: 500 });
  }
}

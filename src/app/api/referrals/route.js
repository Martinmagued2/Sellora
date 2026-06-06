import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    // Get user's referral code and credits
    const { data: account } = await adminClient
      .from("accounts")
      .select("referral_code, referral_credits")
      .eq("id", user.id)
      .single();

    // Get referral history
    const { data: referrals } = await adminClient
      .from("referrals")
      .select("id, referral_code, referred_email, referred_id, status, commission_earned, commission_paid, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    const referralList = referrals || [];

    // Compute stats
    const totalReferrals = referralList.length;
    const conversions = referralList.filter((r) => r.status === "converted" || r.status === "paid").length;
    const totalEarnings = referralList.reduce((sum, r) => sum + (parseFloat(r.commission_earned) || 0), 0);
    const totalPaid = referralList.reduce((sum, r) => sum + (parseFloat(r.commission_paid) || 0), 0);
    const pendingPayout = totalEarnings - totalPaid;

    return Response.json({
      referralCode: account?.referral_code || null,
      referralCredits: parseFloat(account?.referral_credits) || 0,
      stats: {
        totalReferrals,
        conversions,
        totalEarnings,
        totalPaid,
        pendingPayout,
      },
      referrals: referralList,
    });
  } catch (err) {
    console.error("Referrals GET error:", err);
    return Response.json({ error: "Failed to fetch referrals" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    // Check if user already has a referral code
    const { data: account } = await adminClient
      .from("accounts")
      .select("referral_code")
      .eq("id", user.id)
      .single();

    if (account?.referral_code) {
      return Response.json({ referralCode: account.referral_code });
    }

    // Generate a unique referral code
    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let code = generateCode();
    let attempts = 0;

    // Ensure uniqueness across all accounts
    while (attempts < 10) {
      const { data: existing } = await adminClient
        .from("accounts")
        .select("id")
        .eq("referral_code", code)
        .single();

      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    // Update account with referral code
    const { error } = await adminClient
      .from("accounts")
      .update({ referral_code: code })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to save referral code:", error);
      return Response.json({ error: "Failed to generate referral code" }, { status: 500 });
    }

    return Response.json({ referralCode: code });
  } catch (err) {
    console.error("Referrals POST error:", err);
    return Response.json({ error: "Failed to generate referral code" }, { status: 500 });
  }
}

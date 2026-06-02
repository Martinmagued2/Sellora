import { createClient } from "@supabase/supabase-js";
import { sendTeamInviteEmail, isEmailConfigured } from "@/lib/email";
import { NextResponse } from "next/server";

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

export async function POST(req) {
  try {
    const { email, accountId, businessName } = await req.json();

    if (!email || !accountId) {
      return NextResponse.json({ error: "Email and Account ID are required" }, { status: 400 });
    }

    if (!isEmailConfigured()) {
       return NextResponse.json({ error: "Resend API key not configured. Set RESEND_API_KEY in your environment variables." }, { status: 500 });
    }

    // 1. Insert pending invite into the database
    const { data: newMember, error: dbError } = await getSupabaseAdmin()
      .from("team_members")
      .insert({
        account_id: accountId,
        user_id: accountId, // Temporary placeholder until they accept
        role: "agent",
        invited_email: email,
        invite_status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      // If it's a unique constraint violation, they are already on the team
      if (dbError.code === "23505") {
         return NextResponse.json({ error: "This email is already part of your team." }, { status: 400 });
      }
      throw dbError;
    }

    // 2. Send the invitation email via centralized Resend service
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/login?invite=${newMember.id}`;

    const result = await sendTeamInviteEmail({
      to: email,
      businessName: businessName || "a team",
      inviteLink,
    });

    if (!result.success) {
       console.error("Resend error:", result.error);
       return NextResponse.json({ error: "Failed to send email. Ensure you have a verified domain on Resend if sending to external addresses." }, { status: 500 });
    }

    return NextResponse.json({ success: true, member: newMember });

  } catch (error) {
    console.error("Invite Error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

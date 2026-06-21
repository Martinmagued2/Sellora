import { createClient } from "@supabase/supabase-js";
import { sendTeamInviteEmail, isEmailConfigured } from "@/lib/email";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";

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
  // Auth: the account OWNER or an ADMIN can invite team members
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: account } = await supabase
    .from("accounts")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Allow owner (role is null/undefined/owner) OR admin
  const isOwner = !account.role || account.role === "owner";
  const isAdmin = account.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Only the account owner or admin can invite team members" }, { status: 403 });
  }

  try {
    const { email, businessName } = await req.json();
    // 🔒 SECURITY: Use user.id (authenticated) instead of body-supplied accountId
    // — previous code allowed any owner/admin to invite to ANY account (IDOR)
    const accountId = user.id;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 🔒 SECURITY: Validate email format + length
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
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

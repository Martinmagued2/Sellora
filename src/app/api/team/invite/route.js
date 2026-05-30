import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
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

    if (!process.env.RESEND_API_KEY) {
       return NextResponse.json({ error: "Resend API key not configured" }, { status: 500 });
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

    // 2. Send the invitation email via Resend
    // Note: If you don't have a verified domain on Resend, you can only send to the email address associated with your Resend account.
    // Replace "onboarding@resend.dev" with your verified domain email (e.g., hello@sellora.com) once you have one.
    const senderEmail = "onboarding@resend.dev"; 
    
    // Create a simple invite link. In a real app, this would include a secure token.
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/login?invite=${newMember.id}`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `Sellora <${senderEmail}>`,
      to: [email],
      subject: `You've been invited to join ${businessName || "a team"} on Sellora`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>You're Invited!</h2>
          <p>You have been invited to join <strong>${businessName || "a team"}</strong> on Sellora to help manage customer conversations.</p>
          <p>Click the link below to accept the invitation and set up your account:</p>
          <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #6C5CE7; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">Accept Invitation</a>
          <p style="margin-top: 30px; font-size: 12px; color: #888;">If you were not expecting this invitation, you can ignore this email.</p>
        </div>
      `,
    });

    if (emailError) {
       console.error("Resend error:", emailError);
       // We might want to rollback the DB insert here, or mark it as failed, but for now we just return the error.
       return NextResponse.json({ error: "Failed to send email. Ensure you have a verified domain on Resend if sending to external addresses." }, { status: 500 });
    }

    return NextResponse.json({ success: true, member: newMember });

  } catch (error) {
    console.error("Invite Error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

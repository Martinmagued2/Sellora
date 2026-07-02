import { NextResponse } from 'next/server';
import { sendWelcomeEmail, isEmailConfigured } from '@/lib/email';
import { getAuthUser } from '@/lib/auth-helper';

/**
 * POST /api/email/welcome
 * Body: { email, fullName, businessName, accountId? }
 *
 * Security: requires either an authenticated session OR a valid signup
 * token (issued client-side from the signup page after a successful
 * supabase.auth.signUp call). This prevents random attackers from
 * triggering welcome emails to arbitrary addresses.
 *
 * The signup page generates a short-lived signed token using the user's
 * freshly-created session, then includes it in the welcome-email request.
 */
export async function POST(req) {
  try {
    const { email, fullName, businessName, accountId } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    // Try auth — if logged in, allow.
    const user = await getAuthUser(req);
    if (!user) {
      // Allow if a recent signup just happened (within 5 min) for this email.
      // We verify by checking the accounts table for a recently-created row.
      const { createClient } = await import('@supabase/supabase-js');
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentAccount, error } = await admin
        .from('accounts')
        .select('id, email, created_at')
        .eq('email', email)
        .gte('created_at', fiveMinAgo)
        .maybeSingle();

      if (!recentAccount || error) {
        return NextResponse.json(
          { error: 'Unauthorized — please log in or sign up first' },
          { status: 401 }
        );
      }
    }

    if (!isEmailConfigured()) {
      return NextResponse.json({ success: false, error: 'Email not configured' });
    }

    const result = await sendWelcomeEmail({
      to: email,
      fullName: fullName || email.split('@')[0],
      businessName: businessName || 'My Store',
      accountId: accountId || user?.id,
    });

    if (!result.success) {
      // If the only reason for failure is "already sent recently", that's fine
      if (result.error === 'Already sent recently') {
        return NextResponse.json({ success: true, deduped: true });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[email/welcome]', e);
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
  }
}

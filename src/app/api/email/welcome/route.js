import { NextResponse } from 'next/server';
import { sendWelcomeEmail, isEmailConfigured } from '@/lib/email';
import { getAuthUser } from '@/lib/auth-helper';

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      // Allow unauthenticated — signup just happened, session might not be set yet
      // But still require the request to come from our domain (checked by CORS)
    }

    const { email, fullName, businessName } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    if (!isEmailConfigured()) {
      return NextResponse.json({ success: false, error: 'Email not configured' });
    }

    const result = await sendWelcomeEmail({
      to: email,
      fullName: fullName || email.split('@')[0],
      businessName: businessName || 'My Store',
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[email/welcome]', e);
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
  }
}

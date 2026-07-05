import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';
import { getNotifPrefs, updateNotifPrefs } from '@/lib/notifications';

// GET — return the user's notification preferences
export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const prefs = await getNotifPrefs(user.id);
    return NextResponse.json({ prefs });
  } catch (e) {
    console.error('[notif/prefs GET]', e);
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

// PUT — update the user's notification preferences
export async function PUT(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const result = await updateNotifPrefs(user.id, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, prefs: result.prefs });
  } catch (e) {
    console.error('[notif/prefs PUT]', e);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}

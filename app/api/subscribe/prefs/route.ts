import { NextResponse } from 'next/server';
import { normalizePrefs } from '@/lib/prefs';
import { ensureEmailTables, savePrefs } from '@/lib/subscribers';
import { verifyLink } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/** Saves a subscriber's alert settings. The signed link token is the proof of who they are. */
export async function POST(request: Request) {
  let token = '';
  let prefs = normalizePrefs({});
  try {
    const form = await request.formData();
    token = String(form.get('token') ?? '');
    prefs = normalizePrefs({
      roads: form.getAll('roads').map(String),
      days: form.getAll('days').map(String),
      // An unticked box sends nothing, so read these as on only when present.
      morning: form.get('morning') === 'on',
      closures: form.get('closures') === 'on',
      warnings: form.get('warnings') === 'on',
      snow: String(form.get('snow') ?? ''),
      pauseUntil: String(form.get('pauseUntil') ?? ''),
    });
  } catch {
    // Falls through to the error redirect below.
  }
  const id = verifyLink('manage', token);
  let ok = false;
  if (id) {
    try {
      await ensureEmailTables();
      ok = await savePrefs(id, prefs);
    } catch {
      ok = false;
    }
  }
  const back = new URL('/alerts/manage', request.url);
  if (id) back.searchParams.set('token', token);
  back.searchParams.set('state', ok ? 'saved' : 'error');
  return NextResponse.redirect(back, 303);
}

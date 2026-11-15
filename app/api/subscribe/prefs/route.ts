import { NextResponse } from 'next/server';
import { normalizePrefs } from '@/lib/prefs';
import { ensureEmailTables, savePrefs, subscriberById } from '@/lib/subscribers';
import { verifyLink } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/** Saves a subscriber's alert settings. The signed link token is the proof of who they are. */
export async function POST(request: Request) {
  let token = '';
  let form: FormData | null = null;
  try {
    form = await request.formData();
    token = String(form.get('token') ?? '');
  } catch {
    // Falls through to the error redirect below.
  }
  const id = verifyLink('manage', token);
  let ok = false;
  if (id && form) {
    try {
      await ensureEmailTables();
      const person = await subscriberById(id);
      if (person) {
        const before = normalizePrefs(person.prefs);
        // An unticked box sends nothing, so read these as on only when present.
        const on = (name: string) => form!.get(name) === 'on';
        // The text settings are only on the form for people on the text plan. Without them,
        // whatever was saved before is kept.
        const text = form.get('hasText') === '1'
          ? {
              textClosed: on('textClosed'),
              textReopened: on('textReopened'),
              textChainsOn: on('textChainsOn'),
              textChainsOff: on('textChainsOff'),
              textMorning: on('textMorning'),
              quietFrom: String(form.get('quietFrom') ?? ''),
              quietTo: String(form.get('quietTo') ?? ''),
              textCap: String(form.get('textCap') ?? ''),
            }
          : {
              textClosed: before.textClosed,
              textReopened: before.textReopened,
              textChainsOn: before.textChainsOn,
              textChainsOff: before.textChainsOff,
              textMorning: before.textMorning,
              quietFrom: before.quietFrom,
              quietTo: before.quietTo,
              textCap: before.textCap,
            };
        ok = await savePrefs(
          id,
          normalizePrefs({
            roads: form.getAll('roads').map(String),
            days: form.getAll('days').map(String),
            morning: on('morning'),
            closures: on('closures'),
            morningHour: String(form.get('morningHour') ?? ''),
            warnings: on('warnings'),
            snow: String(form.get('snow') ?? ''),
            pauseUntil: String(form.get('pauseUntil') ?? ''),
            ...text,
          }),
        );
      }
    } catch {
      ok = false;
    }
  }
  const back = new URL('/alerts/manage', request.url);
  if (id) back.searchParams.set('token', token);
  back.searchParams.set('state', ok ? 'saved' : 'error');
  return NextResponse.redirect(back, 303);
}

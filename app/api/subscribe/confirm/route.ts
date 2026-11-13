import { NextResponse } from 'next/server';
import { REMEMBER_COOKIE, rememberOptions, rememberValue } from '@/lib/remember';
import { confirmSubscriber, ensureEmailTables } from '@/lib/subscribers';
import { verifyLink } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/** The "Confirm my email" button posts here. A button, not the link itself, so mail scanners cannot confirm by accident. */
export async function POST(request: Request) {
  const back = (query: string) => NextResponse.redirect(new URL(`/alerts/confirm?${query}`, request.url), 303);
  try {
    const form = await request.formData();
    const id = verifyLink('confirm', String(form.get('token') ?? ''));
    if (!id) return back('state=expired');
    await ensureEmailTables();
    if (!(await confirmSubscriber(id))) return back('state=expired');
    // Remember them on this device, so the Alerts page can take them straight to their settings.
    const res = back('state=done');
    res.cookies.set(REMEMBER_COOKIE, rememberValue(id), rememberOptions);
    return res;
  } catch {
    return back('state=error');
  }
}

import { NextResponse } from 'next/server';
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
    return back((await confirmSubscriber(id)) ? 'state=done' : 'state=expired');
  } catch {
    return back('state=error');
  }
}

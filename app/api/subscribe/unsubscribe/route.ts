import { NextResponse } from 'next/server';
import { ensureEmailTables, unsubscribe } from '@/lib/subscribers';
import { verifyLink } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * Unsubscribe. Reached two ways: the button on the unsubscribe page (a form post), and the
 * one-tap unsubscribe built into mail apps, which posts straight to this address with the token in it.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get('token') ?? '';
  let fromPage = false;
  try {
    const form = await request.formData();
    if (form.get('token')) {
      token = String(form.get('token'));
      fromPage = true;
    }
  } catch {
    // One-tap requests may carry no readable form. The token in the address is enough.
  }
  const id = verifyLink('unsub', token);
  let done = false;
  if (id) {
    try {
      await ensureEmailTables();
      done = await unsubscribe(id);
    } catch {
      done = false;
    }
  }
  if (fromPage) {
    return NextResponse.redirect(new URL(`/alerts/unsubscribe?state=${done ? 'done' : 'error'}`, request.url), 303);
  }
  return NextResponse.json({ ok: done }, { status: done ? 200 : 400 });
}

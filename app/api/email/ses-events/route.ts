import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasDb } from '@/lib/db';
import { parseSesEvent } from '@/lib/ses-events';
import { ensureEmailTables, suppress } from '@/lib/subscribers';

export const dynamic = 'force-dynamic';

/**
 * Amazon calls this when an email bounces or someone marks it as spam, so that address is never
 * emailed again. Off unless SES_EVENTS_KEY is set; Amazon must include it as ?key=... in the address.
 */
export async function POST(request: Request) {
  const expected = process.env.SES_EVENTS_KEY ?? '';
  const given = new URL(request.url).searchParams.get('key') ?? '';
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const event = parseSesEvent(await request.text());
  if (event.kind === 'confirm-subscription') {
    // Amazon's one-time handshake when the notification is first set up.
    await fetch(event.url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    return NextResponse.json({ ok: true, confirmed: true });
  }
  if (event.kind === 'suppress' && hasDb()) {
    await ensureEmailTables();
    for (const email of event.emails.slice(0, 50)) await suppress(email, event.reason);
    return NextResponse.json({ ok: true, suppressed: event.emails.length });
  }
  return NextResponse.json({ ok: true });
}

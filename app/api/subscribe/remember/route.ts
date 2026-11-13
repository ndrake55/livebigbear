import { NextResponse } from 'next/server';
import { REMEMBER_COOKIE, rememberOptions, rememberValue } from '@/lib/remember';
import { verifyLink } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * Called by the settings page: someone who opened a genuine settings link is remembered on
 * this device for 30 days. With { forget: true } the device is forgotten.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  if (body.forget === true) {
    res.cookies.set(REMEMBER_COOKIE, '', { ...rememberOptions, maxAge: 0 });
    return res;
  }
  const id = verifyLink('manage', String(body.token ?? ''));
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  res.cookies.set(REMEMBER_COOKIE, rememberValue(id), rememberOptions);
  return res;
}

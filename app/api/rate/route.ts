import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasDb } from '@/lib/db';
import { isItem, myStars, rate, ratingFor } from '@/lib/ratings';
import { fingerprint } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };
const COOKIE = 'lbb_v';

/** A random id kept in a cookie, so one device counts as one rater. It identifies nobody. */
function deviceId(request: Request): { id: string; isNew: boolean } {
  const found = request.headers.get('cookie')?.match(/(?:^|;\s*)lbb_v=([a-f0-9]{32})/)?.[1];
  return found ? { id: found, isNew: false } : { id: randomBytes(16).toString('hex'), isNew: true };
}

function withCookie(res: NextResponse, device: { id: string; isNew: boolean }): NextResponse {
  if (device.isNew) {
    res.cookies.set(COOKIE, device.id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 400 });
  }
  return res;
}

/** The current rating for one item, and this device's own stars if it has rated. */
export async function GET(request: Request) {
  const item = new URL(request.url).searchParams.get('item');
  if (!isItem(item)) return NextResponse.json({ ok: false }, { status: 400, headers: noStore });
  if (!hasDb()) return NextResponse.json({ ok: false, off: true }, { headers: noStore });
  try {
    const device = deviceId(request);
    const [rating, mine] = await Promise.all([ratingFor(item), device.isNew ? null : myStars(item, fingerprint(device.id))]);
    return NextResponse.json({ ok: true, rating, mine }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: noStore });
  }
}

export async function POST(request: Request) {
  if (!hasDb()) return NextResponse.json({ ok: false, message: 'Ratings are not switched on yet.' }, { status: 503, headers: noStore });
  if (Number(request.headers.get('content-length') ?? 0) > 500) {
    return NextResponse.json({ ok: false, message: 'Request too large.' }, { status: 413, headers: noStore });
  }
  // Only this site's own pages may send ratings.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return NextResponse.json({ ok: false, message: 'Please rate from the app.' }, { status: 403, headers: noStore });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: 'Please try again.' }, { status: 400, headers: noStore });
  }
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const device = deviceId(request);
  try {
    const out = await rate(String(body.item ?? ''), fingerprint(device.id), fingerprint(`ip:${ip}`), Number(body.stars));
    if (!out.ok) return NextResponse.json({ ok: false, message: out.message }, { status: out.status, headers: noStore });
    return withCookie(NextResponse.json({ ok: true, rating: out.rating, mine: out.mine }, { headers: noStore }), device);
  } catch {
    return NextResponse.json({ ok: false, message: 'Something went wrong on our side. Please try again shortly.' }, { status: 500, headers: noStore });
  }
}

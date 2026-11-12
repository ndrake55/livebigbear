import { NextResponse } from 'next/server';
import { alertsOn } from '@/lib/alerts-on';
import { handleSignup } from '@/lib/signup';
import { signForm } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/** The signup form asks for a fresh token when it loads. */
export async function GET() {
  if (!alertsOn()) return NextResponse.json({ error: 'off' }, { status: 503, headers: noStore });
  return NextResponse.json({ t: signForm() }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!alertsOn()) {
    return NextResponse.json({ ok: false, message: 'Email alerts are not switched on yet.' }, { status: 503, headers: noStore });
  }
  // Signups are tiny. Anything large is not a signup.
  if (Number(request.headers.get('content-length') ?? 0) > 2000) {
    return NextResponse.json({ ok: false, message: 'Request too large.' }, { status: 413, headers: noStore });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: 'Please try again.' }, { status: 400, headers: noStore });
  }
  const ip =
    request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  try {
    const out = await handleSignup({ email: body.email, trap: body.company, formToken: body.t, ip });
    return NextResponse.json({ ok: out.ok, message: out.message }, { status: out.status, headers: noStore });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Something went wrong on our side. Please try again shortly.' },
      { status: 500, headers: noStore },
    );
  }
}

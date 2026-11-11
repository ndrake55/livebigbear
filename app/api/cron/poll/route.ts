import { NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/caltrans';
import { hasDb, recordStatuses } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Runs on a schedule (see vercel.json). Saves each route's status so history builds up over time. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const snap = await getSnapshot();
  if (!snap.ok) return NextResponse.json({ ok: false, error: snap.error }, { status: 502 });
  if (!hasDb()) return NextResponse.json({ ok: false, error: 'DATABASE_URL is not set' }, { status: 500 });
  try {
    const changed = await recordStatuses(snap.routes);
    return NextResponse.json({ ok: true, changed });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'database error' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/caltrans';
import { hasDb, recordStatuses } from '@/lib/db';
import { COMMUNITIES } from '@/lib/communities';
import { isMailConfigured } from '@/lib/mailer';
import { runStormEmails } from '@/lib/storm-mail';
import { ensureEmailTables, purgeStale } from '@/lib/subscribers';
import { getWeather } from '@/lib/weather';

export const maxDuration = 60;

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
    // Housekeeping for email signups: drop week-old unconfirmed ones and old rate-limit rows.
    await ensureEmailTables();
    await purgeStale();
    // Storm-day emails: a morning summary when chains or closures are in effect, and an alert
    // when a road newly closes. A failure here must not break the status history above.
    let email: unknown = 'Email is not set up.';
    if (isMailConfigured()) {
      try {
        const weather = await getWeather(COMMUNITIES[0]).catch(() => null);
        email = await runStormEmails(snap.routes, changed, weather, new Date());
      } catch (e) {
        email = { error: e instanceof Error ? e.message : 'email error' };
      }
    }
    return NextResponse.json({ ok: true, changed, email });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'database error' },
      { status: 500 },
    );
  }
}

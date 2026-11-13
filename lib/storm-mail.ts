import type { RouteSummary } from './caltrans';
import { getSql } from './db';
import { type Mail, sendMail, siteUrl } from './mailer';
import { APPROACHES } from './routes';
import { HEADLINE, isChains, LABEL, verdict } from './status';
import { normalizePrefs, wants } from './prefs';
import { ensureEmailTables } from './subscribers';
import { signLink } from './tokens';
import type { Weather } from './weather';

const ZONE = 'America/Los_Angeles';
/** The morning summary goes out in this window, Pacific time, on days with chains or closures. */
export const MORNING_FROM_HOUR = 5;
export const MORNING_UNTIL_HOUR = 9;
/** Closure alerts are held overnight so nobody's phone buzzes at 2 AM. */
export const QUIET_FROM_HOUR = 21;
export const QUIET_UNTIL_HOUR = 5;
/** Unsubscribe and settings links in storm emails keep working for a year. */
const LINK_TTL_SECONDS = 60 * 60 * 24 * 365;

export function pacificParts(now: Date): { date: string; hour: number; long: string } {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const long = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  return { date, hour, long };
}

const affected = (routes: RouteSummary[]) => routes.filter((r) => r.level === 'closed' || isChains(r.level));

export type Plan =
  | { kind: 'none'; why: string }
  | { kind: 'morning'; key: string }
  | { kind: 'closure'; key: string; closed: RouteSummary[] };

/**
 * Decides what, if anything, to send right now.
 * - Morning summary: once a day, 5 to 9 AM Pacific, only if a road has chains or is closed.
 * - Closure alert: when a road newly closes outside the morning window and outside quiet hours.
 * `newlyChanged` is the list of road ids whose status just changed.
 */
export function plan(routes: RouteSummary[], newlyChanged: string[], now: Date): Plan {
  const { date, hour } = pacificParts(now);
  const hit = affected(routes);
  if (hour >= MORNING_FROM_HOUR && hour < MORNING_UNTIL_HOUR) {
    return hit.length > 0 ? { kind: 'morning', key: `morning:${date}` } : { kind: 'none', why: 'No chains or closures this morning.' };
  }
  const closed = routes.filter((r) => r.level === 'closed' && newlyChanged.includes(r.def.id));
  if (closed.length === 0) return { kind: 'none', why: 'No road has newly closed.' };
  if (hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR) return { kind: 'none', why: 'A road closed during quiet hours; the morning summary will cover it.' };
  // One alert per road per day at most.
  return { kind: 'closure', key: `closure:${date}:${closed.map((r) => r.def.id).sort().join(',')}`, closed };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLOR: Record<string, string> = { open: '#0a6b78', r1: '#b86e00', r2: '#b86e00', r3: '#b86e00', closed: '#5a1220', unknown: '#6B7B8C' };

/** Builds one storm-day email. `kind` only changes the subject and the opening line. */
export function stormMail(
  to: string,
  kind: 'morning' | 'closure',
  routes: RouteSummary[],
  weather: Weather | null,
  now: Date,
  unsubscribeUrl: string,
  oneClickUrl = unsubscribeUrl,
  /** Link to this subscriber's settings, and the road ids they chose (empty for all). */
  manageUrl = '',
  roads: string[] = [],
): Mail {
  const site = siteUrl();
  const v = verdict(routes.map((r) => ({ id: r.def.id, name: r.def.name, level: r.level })), APPROACHES);
  const closed = routes.filter((r) => r.level === 'closed');
  // The headline looks at every road, because the easiest way up may be one they did not pick.
  const listed = roads.length > 0 ? routes.filter((r) => roads.includes(r.def.id)) : routes;
  const { long } = pacificParts(now);
  const subject =
    kind === 'closure'
      ? `Big Bear road closed: ${closed.map((r) => r.def.name).join(', ')}`
      : `Big Bear roads this morning: ${v.headline.charAt(0).toLowerCase()}${v.headline.slice(1)}`;
  const opening = kind === 'closure' ? `Caltrans has just reported a closure. Here is every road into the valley.` : `Road status for ${long}.`;
  const snow =
    weather?.ok && weather.snow24hIn !== null && weather.snow24hIn >= 0.1 ? `Snow forecast for the next 24 hours: ${weather.snow24hIn} inches.` : '';
  const alert = weather?.ok && weather.alerts[0] ? `${weather.alerts[0].event} in effect.` : '';
  const extra = [alert, snow].filter(Boolean).join(' ');

  const text = [
    opening,
    '',
    v.headline,
    v.detail,
    '',
    ...listed.map((r) => `${r.def.name} (${r.def.sub}): ${HEADLINE[r.level]}`),
    ...(extra ? ['', extra] : []),
    '',
    `Live status, map and cameras: ${site}/`,
    '',
    'Road status comes from Caltrans and can lag conditions on the road. Always follow posted signs.',
    '',
    ...(manageUrl ? [`Choose your roads and days, or pause: ${manageUrl}`] : []),
    `Stop these emails: ${unsubscribeUrl}`,
  ].join('\n');

  const rows = listed
    .map(
      (r) =>
        `<tr><td style="padding:10px 0;border-top:1px solid #E3E9EF"><div style="font-size:16px;font-weight:700">${esc(r.def.name)}</div><div style="font-size:13px;color:#4A5B6C">${esc(r.def.sub)}</div></td><td style="padding:10px 0;border-top:1px solid #E3E9EF;text-align:right;white-space:nowrap"><span style="display:inline-block;background:${COLOR[r.level]};color:#ffffff;font-size:13px;font-weight:700;padding:5px 10px;border-radius:8px">${esc(LABEL[r.level])}</span></td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F2F5F8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#12202E">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px">
<p style="margin:0 0 4px;font-size:20px;font-weight:800">Live Big Bear</p>
<p style="margin:0 0 16px;font-size:14px;color:#4A5B6C">${esc(opening)}</p>
<p style="margin:0 0 4px;font-size:22px;font-weight:800;line-height:1.25">${esc(v.headline)}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${esc(v.detail)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table>
${extra ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.5">${esc(extra)}</p>` : ''}
<p style="margin:20px 0 0"><a href="${site}/" style="display:inline-block;background:#1F4E9C;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 22px;border-radius:12px">See live status and cameras</a></p>
<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#4A5B6C">Road status comes from Caltrans and can lag conditions on the road. Always follow posted signs.<br>You are getting this because you signed up at livebigbear.com. ${manageUrl ? `<a href="${manageUrl}" style="color:#4A5B6C">Choose your roads and days</a> · ` : ''}<a href="${unsubscribeUrl}" style="color:#4A5B6C">Unsubscribe</a></p>
</div></body></html>`;
  return { to, subject, text, html, unsubscribeUrl: oneClickUrl };
}

let ready: Promise<void> | null = null;
function ensureSendLog(): Promise<void> {
  ready ??= (async () => {
    await getSql()`
      CREATE TABLE IF NOT EXISTS email_sends (
        key TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        sent INT NOT NULL DEFAULT 0,
        failed INT NOT NULL DEFAULT 0
      )`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
export const resetSendLogForTests = () => {
  ready = null;
};

export interface SendResult {
  sent: number;
  failed: number;
  skipped?: string;
}

/**
 * Sends the planned email to every confirmed subscriber, once. The send is claimed in the
 * database first, so two overlapping runs cannot both send it.
 */
export async function runStormEmails(
  routes: RouteSummary[],
  newlyChanged: string[],
  weather: Weather | null,
  now: Date,
  send: (mail: Mail) => Promise<void> = sendMail,
): Promise<SendResult> {
  if (process.env.STORM_EMAILS === 'off') return { sent: 0, failed: 0, skipped: 'Storm emails are switched off.' };
  const p = plan(routes, newlyChanged, now);
  if (p.kind === 'none') return { sent: 0, failed: 0, skipped: p.why };
  await Promise.all([ensureEmailTables(), ensureSendLog()]);
  const sql = getSql();
  const claimed = await sql`INSERT INTO email_sends (key, kind) VALUES (${p.key}, ${p.kind}) ON CONFLICT (key) DO NOTHING RETURNING key`;
  if (claimed.length === 0) return { sent: 0, failed: 0, skipped: 'Already sent.' };

  const everyone = await sql`SELECT id, email, prefs FROM email_subscribers WHERE status = 'confirmed' ORDER BY id`;
  const { date } = pacificParts(now);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const about = (p.kind === 'closure' ? p.closed : affected(routes)).map((r) => r.def.id);
  const people = everyone
    .map((s) => ({ id: String(s.id), email: String(s.email), prefs: normalizePrefs(s.prefs) }))
    .filter((s) => wants(s.prefs, p.kind, about, date, weekday));
  const site = siteUrl();
  let sent = 0;
  let failed = 0;
  // A few at a time keeps well under Amazon's per-second limit.
  for (let i = 0; i < people.length; i += 5) {
    const batch = people.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((s) => {
        const token = encodeURIComponent(signLink('unsub', s.id, LINK_TTL_SECONDS, now.getTime()));
        const manage = encodeURIComponent(signLink('manage', s.id, LINK_TTL_SECONDS, now.getTime()));
        return send(
          stormMail(
            s.email,
            p.kind,
            routes,
            weather,
            now,
            `${site}/alerts/unsubscribe?token=${token}`,
            `${site}/api/subscribe/unsubscribe?token=${token}`,
            `${site}/alerts/manage?token=${manage}`,
            s.prefs.roads,
          ),
        );
      }),
    );
    for (const r of results) r.status === 'fulfilled' ? sent++ : failed++;
  }
  await sql`UPDATE email_sends SET sent = ${sent}, failed = ${failed} WHERE key = ${p.key}`;
  return { sent, failed };
}

/** The most recent sends, for the status page. */
export async function recentSends(): Promise<{ key: string; sent: number; failed: number; at: string }[]> {
  await ensureSendLog();
  const rows = await getSql()`SELECT key, sent, failed, started_at FROM email_sends ORDER BY started_at DESC LIMIT 5`;
  return rows.map((r) => ({ key: String(r.key), sent: Number(r.sent), failed: Number(r.failed), at: new Date(r.started_at).toISOString() }));
}

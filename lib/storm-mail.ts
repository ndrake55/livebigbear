import type { RouteSummary } from './caltrans';
import { getSql } from './db';
import { type Mail, sendMail, siteUrl } from './mailer';
import { APPROACHES } from './routes';
import { HEADLINE, isChains, LABEL, verdict } from './status';
import { normalizePrefs, type Prefs, SNOW_STEPS, wants, wantsWeather } from './prefs';
import { ensureEmailTables } from './subscribers';
import { signLink } from './tokens';
import type { Weather, WeatherAlert } from './weather';

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

/** Weather emails go out between these hours, Pacific time. Mornings belong to the road summary. */
export const WEATHER_FROM_HOUR = 9;
export const WEATHER_UNTIL_HOUR = 21;

/** Warnings worth an email: winter weather, wind and flooding. Fire and evacuation notices are left to the agencies. */
export const isAlertable = (event: string) =>
  /\b(warning|watch|advisory)\b/i.test(event) && /(winter storm|blizzard|ice storm|winter weather|snow squall|lake effect snow|high wind|wind advisory|flash flood|flood warning|flood watch|extreme cold|cold weather)/i.test(event);

export type WeatherPlan =
  | { kind: 'snow'; key: string; previousKey: string; bucket: number; inches: number }
  | { kind: 'warning'; key: string; previousKey: string; alert: WeatherAlert };

const dayBefore = (date: string) => new Date(new Date(`${date}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Weather emails that are due right now. Each has a key for today and the matching key for
 * yesterday: a storm that lasts several days is announced once, not every day.
 */
export function weatherPlans(weather: Weather | null, now: Date): WeatherPlan[] {
  if (!weather?.ok) return [];
  const { date, hour } = pacificParts(now);
  if (hour < WEATHER_FROM_HOUR || hour >= WEATHER_UNTIL_HOUR) return [];
  const yesterday = dayBefore(date);
  const out: WeatherPlan[] = [];
  const inches = weather.snow24hIn ?? 0;
  for (const bucket of SNOW_STEPS) {
    if (inches >= bucket) out.push({ kind: 'snow', key: `snow:${date}:${bucket}`, previousKey: `snow:${yesterday}:${bucket}`, bucket, inches });
  }
  const seen = new Set<string>();
  for (const alert of weather.alerts) {
    const id = slug(alert.event);
    if (!isAlertable(alert.event) || seen.has(id)) continue;
    seen.add(id);
    out.push({ kind: 'warning', key: `warning:${date}:${id}`, previousKey: `warning:${yesterday}:${id}`, alert });
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLOR: Record<string, string> = { open: '#0a6b78', r1: '#b86e00', r2: '#b86e00', r3: '#b86e00', closed: '#5a1220', unknown: '#6B7B8C' };

/** Builds one storm-day email. `kind` only changes the subject and the opening line. */
export function stormMail(
  to: string,
  kind: 'morning' | 'closure' | 'snow' | 'warning',
  routes: RouteSummary[],
  weather: Weather | null,
  now: Date,
  unsubscribeUrl: string,
  oneClickUrl = unsubscribeUrl,
  /** Link to this subscriber's settings, and the road ids they chose (empty for all). */
  manageUrl = '',
  roads: string[] = [],
  /** For snow and warning emails: what the email is about. */
  about?: { inches?: number; alert?: WeatherAlert },
): Mail {
  const site = siteUrl();
  const v = verdict(routes.map((r) => ({ id: r.def.id, name: r.def.name, level: r.level })), APPROACHES);
  const closed = routes.filter((r) => r.level === 'closed');
  // The headline looks at every road, because the easiest way up may be one they did not pick.
  const listed = roads.length > 0 ? routes.filter((r) => roads.includes(r.def.id)) : routes;
  const { long } = pacificParts(now);
  let subject = `Big Bear roads this morning: ${v.headline.charAt(0).toLowerCase()}${v.headline.slice(1)}`;
  let opening = `Road status for ${long}.`;
  let big = v.headline;
  let detail = v.detail;
  if (kind === 'closure') {
    subject = `Big Bear road closed: ${closed.map((r) => r.def.name).join(', ')}`;
    opening = 'Caltrans has just reported a closure. Here is every road into the valley.';
  } else if (kind === 'snow') {
    const n = about?.inches ?? 0;
    subject = `Snow for Big Bear: ${n} inches forecast in the next 24 hours`;
    opening = `Snow forecast, ${long}.`;
    big = `${n} inches of snow forecast`;
    detail = `The National Weather Service expects about ${n} inches at Big Bear Lake in the next 24 hours. Roads right now: ${v.headline.charAt(0).toLowerCase()}${v.headline.slice(1)}.`;
  } else if (kind === 'warning') {
    const event = about?.alert?.event ?? 'Weather warning';
    subject = `${event} for Big Bear`;
    opening = `From the National Weather Service, ${long}.`;
    big = event;
    detail = `${about?.alert?.headline ? `${about.alert.headline}. ` : ''}Roads right now: ${v.headline.charAt(0).toLowerCase()}${v.headline.slice(1)}.`.replace(/\.\. /g, '. ');
  }
  const snow =
    weather?.ok && weather.snow24hIn !== null && weather.snow24hIn >= 0.1 ? `Snow forecast for the next 24 hours: ${weather.snow24hIn} inches.` : '';
  const alert = weather?.ok && weather.alerts[0] ? `${weather.alerts[0].event} in effect.` : '';
  // A snow or warning email already says its own news in the headline.
  const extra = [kind === 'warning' ? '' : alert, kind === 'snow' ? '' : snow].filter(Boolean).join(' ');

  const text = [
    opening,
    '',
    big,
    detail,
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
<p style="margin:0 0 4px;font-size:22px;font-weight:800;line-height:1.25">${esc(big)}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${esc(detail)}</p>
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
type Person = { id: string; email: string; prefs: Prefs };

async function deliver(
  key: string,
  kind: 'morning' | 'closure' | 'snow' | 'warning',
  people: Person[],
  build: (p: Person, unsub: string, oneClick: string, manage: string) => Mail,
  now: Date,
  send: (mail: Mail) => Promise<void>,
): Promise<SendResult> {
  const sql = getSql();
  // Claim the send first, so two overlapping runs cannot both send it.
  const claimed = await sql`INSERT INTO email_sends (key, kind) VALUES (${key}, ${kind}) ON CONFLICT (key) DO NOTHING RETURNING key`;
  if (claimed.length === 0) return { sent: 0, failed: 0, skipped: 'Already sent.' };
  const site = siteUrl();
  let sent = 0;
  let failed = 0;
  // A few at a time keeps well under Amazon's per-second limit.
  for (let i = 0; i < people.length; i += 5) {
    const results = await Promise.allSettled(
      people.slice(i, i + 5).map((s) => {
        const token = encodeURIComponent(signLink('unsub', s.id, LINK_TTL_SECONDS, now.getTime()));
        const manage = encodeURIComponent(signLink('manage', s.id, LINK_TTL_SECONDS, now.getTime()));
        return send(build(s, `${site}/alerts/unsubscribe?token=${token}`, `${site}/api/subscribe/unsubscribe?token=${token}`, `${site}/alerts/manage?token=${manage}`));
      }),
    );
    for (const r of results) r.status === 'fulfilled' ? sent++ : failed++;
  }
  await sql`UPDATE email_sends SET sent = ${sent}, failed = ${failed} WHERE key = ${key}`;
  return { sent, failed };
}

/**
 * Sends whatever is due to the confirmed subscribers who asked for it, once each:
 * the road email (morning summary or closure alert) and any snow or warning emails.
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
  const wx = weatherPlans(weather, now);
  if (p.kind === 'none' && wx.length === 0) return { sent: 0, failed: 0, skipped: p.why };
  await Promise.all([ensureEmailTables(), ensureSendLog()]);
  const sql = getSql();
  const everyone: Person[] = (await sql`SELECT id, email, prefs FROM email_subscribers WHERE status = 'confirmed' ORDER BY id`).map((s) => ({
    id: String(s.id),
    email: String(s.email),
    prefs: normalizePrefs(s.prefs),
  }));
  const { date } = pacificParts(now);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const total: SendResult = { sent: 0, failed: 0 };
  const add = (r: SendResult) => {
    total.sent += r.sent;
    total.failed += r.failed;
    if (r.skipped && total.sent + total.failed === 0) total.skipped = r.skipped;
    else delete total.skipped;
  };

  if (p.kind !== 'none') {
    const roadKind = p.kind;
    const about = (p.kind === 'closure' ? p.closed : affected(routes)).map((r) => r.def.id);
    const people = everyone.filter((s) => wants(s.prefs, roadKind, about, date, weekday));
    add(await deliver(p.key, roadKind, people, (s, unsub, one, manage) => stormMail(s.email, roadKind, routes, weather, now, unsub, one, manage, s.prefs.roads), now, send));
  }

  for (const w of wx) {
    // Announced yesterday already: a storm lasting several days is not repeated daily.
    const before = await sql`SELECT 1 FROM email_sends WHERE key = ${w.previousKey}`;
    if (before.length > 0) {
      await sql`INSERT INTO email_sends (key, kind) VALUES (${w.key}, ${w.kind}) ON CONFLICT (key) DO NOTHING`;
      continue;
    }
    const people = everyone.filter((s) => wantsWeather(s.prefs, w.kind, w.kind === 'snow' ? w.bucket : 0, date, weekday));
    const about = w.kind === 'snow' ? { inches: w.inches } : { alert: w.alert };
    add(await deliver(w.key, w.kind, people, (s, unsub, one, manage) => stormMail(s.email, w.kind, routes, weather, now, unsub, one, manage, s.prefs.roads, about), now, send));
  }
  return total;
}

/** The most recent sends, for the status page. */
export async function recentSends(): Promise<{ key: string; sent: number; failed: number; at: string }[]> {
  await ensureSendLog();
  const rows = await getSql()`SELECT key, sent, failed, started_at FROM email_sends ORDER BY started_at DESC LIMIT 5`;
  return rows.map((r) => ({ key: String(r.key), sent: Number(r.sent), failed: Number(r.failed), at: new Date(r.started_at).toISOString() }));
}

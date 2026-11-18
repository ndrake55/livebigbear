import { randomInt } from 'node:crypto';
import type { RouteSummary } from './caltrans';
import { getSql, hasDb, type StatusChange } from './db';
import { DEFAULT_PREFS, normalizePrefs, wantsText } from './prefs';
import { APPROACHES, routeById } from './routes';
import { changeText, codeText, eventFor, isSmsConfigured, normalizePhone, type RoadChange, sendText, welcomeText } from './sms';
import { isChains, type Level, verdict } from './status';
import { pacificParts } from './storm-mail';
import { isStripeConfigured, type PaidSession } from './stripe';
import { allow, ensureEmailTables } from './subscribers';
import { fingerprint } from './tokens';

/** The paid text plan is on only when the database, Twilio and Stripe are all set up. */
export const textsOn = () => hasDb() && isSmsConfigured() && isStripeConfigured();

/** Accounts with no email address of their own are stored with a stand-in that can never receive mail. */
export const TEXT_ONLY_DOMAIN = '@text.invalid';
export const isTextOnly = (email: string) => email.endsWith(TEXT_ONLY_DOMAIN);

export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;
export const CODES_PER_NUMBER_PER_HOUR = 3;
export const CODES_PER_DAY_SITE_WIDE = 300;

let ready: Promise<void> | null = null;
export function ensureTextTables(): Promise<void> {
  ready ??= (async () => {
    await ensureEmailTables();
    const sql = getSql();
    await sql`ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS phone TEXT`;
    await sql`ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`;
    await sql`ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS text_status TEXT NOT NULL DEFAULT 'none'`;
    await sql`ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS stripe_customer TEXT`;
    await sql`ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS stripe_subscription TEXT`;
    await sql`ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS texts_stopped BOOLEAN NOT NULL DEFAULT false`;
    await sql`
      CREATE TABLE IF NOT EXISTS text_codes (
        phone TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        tries INT NOT NULL DEFAULT 0
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS text_log (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        subscriber BIGINT NOT NULL,
        kind TEXT NOT NULL,
        day TEXT NOT NULL,
        at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS text_log_subscriber_day ON text_log (subscriber, day)`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
export const resetTextTablesForTests = () => {
  ready = null;
};

type Texter = (to: string, body: string) => Promise<void>;

export interface TextState {
  /** none: never bought. active: paid. past_due: a payment failed. canceled: ended. */
  status: 'none' | 'active' | 'past_due' | 'canceled';
  phone: string;
  verified: boolean;
  /** They replied STOP, so carriers will not deliver our texts until they reply START. */
  stopped: boolean;
  customer: string;
}

export async function textState(id: string): Promise<TextState> {
  await ensureTextTables();
  const rows = await getSql()`
    SELECT phone, phone_verified_at, text_status, stripe_customer, texts_stopped FROM email_subscribers WHERE id = ${id}::bigint`;
  const r = rows[0];
  if (!r) return { status: 'none', phone: '', verified: false, stopped: false, customer: '' };
  return {
    status: (['active', 'past_due', 'canceled'].includes(String(r.text_status)) ? r.text_status : 'none') as TextState['status'],
    phone: String(r.phone ?? ''),
    verified: Boolean(r.phone_verified_at),
    stopped: Boolean(r.texts_stopped),
    customer: String(r.stripe_customer ?? ''),
  };
}

/**
 * Sends a six-digit code to a number. Limited per number and across the whole site, because
 * every text costs money and code forms are a known target for abuse.
 */
export async function sendCode(phone: string, send: Texter = sendText): Promise<boolean> {
  await ensureTextTables();
  if (!(await allow(`code:${fingerprint(phone)}`, CODES_PER_NUMBER_PER_HOUR, 60))) return false;
  if (!(await allow('codes-all', CODES_PER_DAY_SITE_WIDE, 1440))) return false;
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await getSql()`
    INSERT INTO text_codes (phone, code_hash, expires_at, tries)
    VALUES (${phone}, ${fingerprint(`code:${phone}:${code}`)}, now() + make_interval(mins => ${CODE_MINUTES}::int), 0)
    ON CONFLICT (phone) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, tries = 0`;
  await send(phone, codeText(code));
  return true;
}

/** True once, for the right code, before it expires and within the allowed number of tries. */
export async function checkCode(phone: string, code: string): Promise<boolean> {
  await ensureTextTables();
  const sql = getSql();
  const clean = String(code).replace(/\D/g, '');
  const rows = await sql`
    UPDATE text_codes SET tries = tries + 1
    WHERE phone = ${phone} AND expires_at > now() AND tries < ${CODE_TRIES}
    RETURNING code_hash`;
  if (rows.length === 0 || clean.length !== 6) return false;
  if (String(rows[0].code_hash) !== fingerprint(`code:${phone}:${clean}`)) return false;
  await sql`DELETE FROM text_codes WHERE phone = ${phone}`;
  return true;
}

/**
 * Records a paid checkout against a subscriber, creating one from the checkout email if needed.
 * Safe to run twice for the same checkout: Stripe tells us both by notification and when the
 * customer returns to the site. Returns the subscriber id and whether a code should be texted.
 */
export async function linkCheckout(s: PaidSession): Promise<{ id: string; needsCode: boolean; phone: string } | null> {
  await ensureTextTables();
  const sql = getSql();
  const phone = normalizePhone(s.phone) ?? '';
  let id = '';
  if (s.subscriberId) {
    const found = await sql`SELECT id FROM email_subscribers WHERE id = ${s.subscriberId}::bigint`;
    if (found[0]) id = String(found[0].id);
  }
  if (!id) {
    const byCustomer = await sql`SELECT id FROM email_subscribers WHERE stripe_customer = ${s.customerId}`;
    if (byCustomer[0]) id = String(byCustomer[0].id);
  }
  if (!id) {
    // A new account. They bought texts, not email, so the email kinds start switched off.
    // Typing an address at the checkout does not prove it is theirs, so an address that is
    // already on the list is never taken over: the plan gets an account of its own instead,
    // reached by phone. (Buying from the settings page keeps everything in one account.)
    const quiet = JSON.stringify({ ...DEFAULT_PREFS, morning: false, closures: false, snow: 0, warnings: false });
    const taken = s.email ? await sql`SELECT 1 FROM email_subscribers WHERE email = ${s.email}` : [{}];
    const own = taken.length === 0;
    const email = own ? s.email : `text-${fingerprint(s.customerId).slice(0, 20)}${TEXT_ONLY_DOMAIN}`;
    const made = await sql`
      INSERT INTO email_subscribers (email, status, confirmed_at, prefs)
      VALUES (${email}, ${own ? 'confirmed' : 'text-only'}, now(), ${quiet}::jsonb)
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id`;
    id = String(made[0].id);
  }
  if (!id) return null;
  const before = await sql`SELECT phone, phone_verified_at, stripe_subscription FROM email_subscribers WHERE id = ${id}::bigint`;
  const samePhone = phone !== '' && String(before[0]?.phone ?? '') === phone;
  const verified = samePhone && Boolean(before[0]?.phone_verified_at);
  await sql`
    UPDATE email_subscribers SET
      text_status = 'active', stripe_customer = ${s.customerId}, stripe_subscription = ${s.subscriptionId},
      phone = CASE WHEN ${phone} = '' THEN phone ELSE ${phone} END,
      phone_verified_at = CASE WHEN ${verified} THEN phone_verified_at ELSE NULL END,
      texts_stopped = false
    WHERE id = ${id}::bigint`;
  // Text a code only the first time this checkout is seen, and only if the number still needs proving.
  const firstTime = String(before[0]?.stripe_subscription ?? '') !== s.subscriptionId;
  return { id, needsCode: firstTime && phone !== '' && !verified, phone };
}

/** Marks the number as proven and sends the welcome text carriers expect. */
export async function verifyPhone(id: string, code: string, send: Texter = sendText): Promise<boolean> {
  const st = await textState(id);
  if (!st.phone || st.status === 'none') return false;
  if (!(await checkCode(st.phone, code))) return false;
  await getSql()`UPDATE email_subscribers SET phone_verified_at = now() WHERE id = ${id}::bigint`;
  await send(st.phone, welcomeText()).catch(() => {});
  return true;
}

/** A paying subscriber replaces their number. The new one must be proven with a code. */
export async function changePhone(id: string, raw: string, send: Texter = sendText): Promise<'ok' | 'bad-number' | 'not-paid' | 'slow-down'> {
  const phone = normalizePhone(raw);
  if (!phone) return 'bad-number';
  const st = await textState(id);
  if (st.status === 'none' || st.status === 'canceled') return 'not-paid';
  await getSql()`UPDATE email_subscribers SET phone = ${phone}, phone_verified_at = NULL, texts_stopped = false WHERE id = ${id}::bigint`;
  return (await sendCode(phone, send)) ? 'ok' : 'slow-down';
}

/** For signing in by phone: the subscriber who owns this proven number on a current plan. */
export async function subscriberByPhone(phone: string): Promise<string | null> {
  await ensureTextTables();
  const rows = await getSql()`
    SELECT id FROM email_subscribers
    WHERE phone = ${phone} AND phone_verified_at IS NOT NULL AND text_status IN ('active', 'past_due') ORDER BY id LIMIT 1`;
  return rows[0] ? String(rows[0].id) : null;
}

/** Stripe says a subscription changed: keep paying customers on and stop texting the rest. */
export async function applySubscriptionStatus(subscriptionId: string, stripeStatus: string): Promise<void> {
  await ensureTextTables();
  const status = stripeStatus === 'active' || stripeStatus === 'trialing' ? 'active' : stripeStatus === 'past_due' ? 'past_due' : 'canceled';
  await getSql()`UPDATE email_subscribers SET text_status = ${status} WHERE stripe_subscription = ${subscriptionId}`;
}

/**
 * Ends the text plan for a Stripe customer, after a full refund or a payment dispute.
 * Returns the subscription to cancel at Stripe, or '' if the customer is not one of ours.
 */
export async function endPlanForCustomer(customerId: string): Promise<string> {
  if (!customerId) return '';
  await ensureTextTables();
  const rows = await getSql()`
    UPDATE email_subscribers SET text_status = 'canceled'
    WHERE stripe_customer = ${customerId} AND text_status IN ('active', 'past_due')
    RETURNING stripe_subscription`;
  return rows[0] ? String(rows[0].stripe_subscription ?? '') : '';
}

/**
 * Forgets a plan whose customer Stripe does not know, which happens to anything bought with
 * test cards before the switch to live payments. The person can then buy the plan for real.
 */
export async function forgetUnknownPlan(id: string): Promise<void> {
  await ensureTextTables();
  await getSql()`
    UPDATE email_subscribers SET text_status = 'none', stripe_customer = NULL, stripe_subscription = NULL
    WHERE id = ${id}::bigint`;
}

/** STOP, START and the like, as reported by Twilio. */
export async function applyReply(fromPhone: string, body: string): Promise<'stopped' | 'started' | 'ignored'> {
  const phone = normalizePhone(fromPhone);
  const word = body.trim().toUpperCase();
  if (!phone) return 'ignored';
  await ensureTextTables();
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(word)) {
    await getSql()`UPDATE email_subscribers SET texts_stopped = true WHERE phone = ${phone}`;
    return 'stopped';
  }
  if (['START', 'YES', 'UNSTOP'].includes(word)) {
    await getSql()`UPDATE email_subscribers SET texts_stopped = false WHERE phone = ${phone}`;
    return 'started';
  }
  return 'ignored';
}

export interface TextRun {
  sent: number;
  failed: number;
  capped: number;
}

interface Reader {
  id: string;
  phone: string;
  prefs: ReturnType<typeof normalizePrefs>;
}

async function readers(): Promise<Reader[]> {
  const rows = await getSql()`
    SELECT id, phone, prefs FROM email_subscribers
    WHERE text_status = 'active' AND phone_verified_at IS NOT NULL AND texts_stopped = false AND phone IS NOT NULL ORDER BY id`;
  return rows.map((r) => ({ id: String(r.id), phone: String(r.phone), prefs: normalizePrefs(r.prefs) }));
}

async function textOnce(r: Reader, kind: string, day: string, body: string, send: Texter, run: TextRun): Promise<void> {
  const sql = getSql();
  const used = await sql`SELECT count(*)::int AS n FROM text_log WHERE subscriber = ${r.id}::bigint AND day = ${day}`;
  if (used[0].n >= r.prefs.textCap) {
    run.capped++;
    return;
  }
  await sql`INSERT INTO text_log (subscriber, kind, day) VALUES (${r.id}::bigint, ${kind}, ${day})`;
  try {
    await send(r.phone, body);
    run.sent++;
  } catch {
    run.failed++;
  }
}

/**
 * Texts paying subscribers about roads that just changed: closures, reopenings, chain controls
 * going on and coming off. Everything one person cares about in this check goes in one text.
 */
export async function runTextAlerts(routes: RouteSummary[], changes: StatusChange[], now: Date, send: Texter = sendText): Promise<TextRun> {
  const run: TextRun = { sent: 0, failed: 0, capped: 0 };
  const events: RoadChange[] = [];
  for (const c of changes) {
    const event = eventFor(c.from, c.to as Level);
    const def = routeById(c.id);
    if (event && def) events.push({ id: c.id, name: def.name, event, to: c.to as Level });
  }
  if (events.length === 0 || process.env.TEXT_ALERTS === 'off') return run;
  await ensureTextTables();
  const { date, hour } = pacificParts(now);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  for (const r of await readers()) {
    const mine = events.filter((e) => wantsText(r.prefs, e.event, e.id, date, weekday, hour));
    if (mine.length > 0) await textOnce(r, 'change', date, changeText(mine), send, run);
  }
  return run;
}

/** The short morning summary by text, at each person's chosen hour, on days with chains or closures. */
export async function runMorningTexts(routes: RouteSummary[], now: Date, send: Texter = sendText): Promise<TextRun> {
  const run: TextRun = { sent: 0, failed: 0, capped: 0 };
  const hit = routes.filter((r) => r.level === 'closed' || isChains(r.level));
  const { date, hour } = pacificParts(now);
  if (hit.length === 0 || hour < 5 || hour >= 9 || process.env.TEXT_ALERTS === 'off') return run;
  await ensureTextTables();
  const sql = getSql();
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const v = verdict(routes.map((r) => ({ id: r.def.id, name: r.def.name, level: r.level })), APPROACHES);
  for (const r of await readers()) {
    const p = r.prefs;
    // The person picked this hour themselves, so it wins over their quiet hours.
    if (!p.textMorning || p.morningHour !== hour) continue;
    if ((p.pauseUntil && date < p.pauseUntil) || (p.days.length > 0 && !p.days.includes(weekday))) continue;
    if (p.roads.length > 0 && !hit.some((x) => p.roads.includes(x.def.id))) continue;
    const already = await sql`SELECT 1 FROM text_log WHERE subscriber = ${r.id}::bigint AND day = ${date} AND kind = 'morning'`;
    if (already.length > 0) continue;
    await textOnce(r, 'morning', date, `Live Big Bear: ${v.headline}. ${v.detail} livebigbear.com Reply STOP to end.`, send, run);
  }
  return run;
}

export async function textCounts(): Promise<{ active: number; verified: number; stopped: number; today: number }> {
  await ensureTextTables();
  const sql = getSql();
  const a = await sql`
    SELECT count(*) FILTER (WHERE text_status = 'active')::int AS active,
           count(*) FILTER (WHERE text_status = 'active' AND phone_verified_at IS NOT NULL)::int AS verified,
           count(*) FILTER (WHERE texts_stopped)::int AS stopped
    FROM email_subscribers`;
  const t = await sql`SELECT count(*)::int AS n FROM text_log WHERE at > now() - interval '1 day'`;
  return { active: a[0].active, verified: a[0].verified, stopped: a[0].stopped, today: t[0].n };
}

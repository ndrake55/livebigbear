import { getSql } from './db';

let ready: Promise<void> | null = null;

/** Create the tables on first use. Safe to call every time. */
export function ensureEmailTables(): Promise<void> {
  ready ??= (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS email_subscribers (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        confirmed_at TIMESTAMPTZ,
        last_confirm_sent_at TIMESTAMPTZ,
        suppressed_reason TEXT
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS email_rate (
        key TEXT NOT NULL,
        at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS email_rate_key_at ON email_rate (key, at)`;
    await sql`ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS last_manage_sent_at TIMESTAMPTZ`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/** For tests: forget that the tables were created. */
export const resetEmailTablesForTests = () => {
  ready = null;
};

/**
 * Count one use of `key` and say whether it is still within `limit` per `minutes`.
 * Refused attempts are not counted, so a blocked visitor is let back in once the window passes.
 */
export async function allow(key: string, limit: number, minutes: number): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT count(*)::int AS n FROM email_rate
    WHERE key = ${key} AND at > now() - make_interval(mins => ${minutes}::int)`;
  if (rows[0].n >= limit) return false;
  await sql`INSERT INTO email_rate (key) VALUES (${key})`;
  return true;
}

export interface SignupResult {
  /** Subscriber id to email a confirmation link to, or null when no email should go out. */
  sendTo: string | null;
  /** Already confirmed: the id to email a "manage my alerts" link to, at most once per 15 minutes. */
  manageFor?: string;
}

/**
 * Register interest from an address. Decides whether a confirmation email should be sent:
 * never to confirmed or blocked addresses, and at most once per 15 minutes to anyone.
 */
export async function requestSignup(email: string): Promise<SignupResult> {
  const sql = getSql();
  const found = await sql`
    SELECT id, status,
      (last_confirm_sent_at IS NOT NULL AND last_confirm_sent_at > now() - interval '15 minutes') AS recent
    FROM email_subscribers WHERE email = ${email}`;
  if (found.length === 0) {
    const made = await sql`
      INSERT INTO email_subscribers (email, last_confirm_sent_at) VALUES (${email}, now())
      ON CONFLICT (email) DO NOTHING RETURNING id`;
    return { sendTo: made.length ? String(made[0].id) : null };
  }
  const row = found[0];
  if (row.status === 'confirmed') {
    // Someone already on the list typing their address again most likely wants their settings.
    const due = await sql`
      UPDATE email_subscribers SET last_manage_sent_at = now()
      WHERE id = ${String(row.id)}::bigint AND (last_manage_sent_at IS NULL OR last_manage_sent_at < now() - interval '15 minutes')
      RETURNING id`;
    return due.length ? { sendTo: null, manageFor: String(row.id) } : { sendTo: null };
  }
  if (row.status === 'suppressed' || row.recent) return { sendTo: null };
  await sql`
    UPDATE email_subscribers SET status = 'pending', last_confirm_sent_at = now()
    WHERE id = ${String(row.id)}::bigint`;
  return { sendTo: String(row.id) };
}

/** The confirmation email failed to send: let the person try again straight away. */
export async function forgetSendAttempt(id: string): Promise<void> {
  await getSql()`UPDATE email_subscribers SET last_confirm_sent_at = NULL WHERE id = ${id}::bigint`;
}

export async function confirmSubscriber(id: string): Promise<boolean> {
  const rows = await getSql()`
    UPDATE email_subscribers SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, now())
    WHERE id = ${id}::bigint AND status IN ('pending', 'confirmed') RETURNING id`;
  return rows.length > 0;
}

export async function unsubscribe(id: string): Promise<boolean> {
  const rows = await getSql()`
    UPDATE email_subscribers SET status = 'unsubscribed'
    WHERE id = ${id}::bigint AND status <> 'suppressed' RETURNING id`;
  return rows.length > 0;
}

/** Never email this address again (it bounced, or the person marked our mail as spam). */
export async function suppress(email: string, reason: string): Promise<void> {
  await getSql()`
    INSERT INTO email_subscribers (email, status, suppressed_reason) VALUES (${email}, 'suppressed', ${reason})
    ON CONFLICT (email) DO UPDATE SET status = 'suppressed', suppressed_reason = ${reason}`;
}

/** Housekeeping: drop signups never confirmed within a week, and old rate-limit rows. */
export async function purgeStale(): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM email_subscribers WHERE status = 'pending' AND created_at < now() - interval '7 days'`;
  await sql`DELETE FROM email_rate WHERE at < now() - interval '1 day'`;
}

export async function subscriberCounts(): Promise<Record<string, number>> {
  const rows = await getSql()`SELECT status, count(*)::int AS n FROM email_subscribers GROUP BY status`;
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

/** One confirmed subscriber's address and settings, or null if they are not on the list. */
export async function subscriberById(id: string): Promise<{ id: string; email: string; prefs: unknown } | null> {
  const rows = await getSql()`SELECT id, email, prefs FROM email_subscribers WHERE id = ${id}::bigint AND status = 'confirmed'`;
  return rows[0] ? { id: String(rows[0].id), email: String(rows[0].email), prefs: rows[0].prefs } : null;
}

export async function savePrefs(id: string, prefs: object): Promise<boolean> {
  const rows = await getSql()`
    UPDATE email_subscribers SET prefs = ${JSON.stringify(prefs)}::jsonb
    WHERE id = ${id}::bigint AND status = 'confirmed' RETURNING id`;
  return rows.length > 0;
}

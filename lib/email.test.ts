import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { summarize } from './caltrans';
import { recordStatuses, setSqlForTests, type Sql } from './db';
import { canReceiveMail, isDisposable, normalizeEmail } from './email-check';
import type { Mail } from './mailer';
import { STORM_SAMPLE } from './sample';
import { parseSesEvent, isSnsUrl } from './ses-events';
import { handleSignup, MIN_FORM_MS } from './signup';
import {
  allow,
  confirmSubscriber,
  ensureEmailTables,
  purgeStale,
  resetEmailTablesForTests,
  subscriberCounts,
  suppress,
  unsubscribe,
} from './subscribers';
import { formAge, signForm, signLink, verifyLink } from './tokens';

// A real Postgres running in memory, so the SQL itself is tested.
let pg: PGlite;
const sql: Sql = async (strings, ...values) => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  return (await pg.query(text, values as any[])).rows as Record<string, any>[];
};

beforeAll(async () => {
  process.env.EMAIL_TOKEN_SECRET = 'test-secret';
  pg = new PGlite();
  setSqlForTests(sql);
});
afterAll(async () => {
  setSqlForTests(null);
  await pg.close();
});
beforeEach(async () => {
  await pg.exec('DROP TABLE IF EXISTS email_subscribers; DROP TABLE IF EXISTS email_rate; DROP TABLE IF EXISTS route_status_log;');
  resetEmailTablesForTests();
});

describe('email address checks', () => {
  it('normalizes good addresses and rejects bad ones', () => {
    expect(normalizeEmail('  Pat.Smith+bb@Example.COM ')).toBe('pat.smith+bb@example.com');
    for (const bad of ['', 'nope', 'a@b', 'a b@example.com', 'a@@example.com', 'a..b@example.com', 'a@-bad.com', `${'x'.repeat(70)}@example.com`, 'a@example.com\nBcc: x@y.com']) {
      expect(normalizeEmail(bad)).toBeNull();
    }
    expect(isDisposable('x@mailinator.com')).toBe(true);
    expect(isDisposable('x@gmail.com')).toBe(false);
  });
  it('checks whether a domain can receive mail', async () => {
    const fail = (code: string) => async () => { throw Object.assign(new Error(code), { code }); };
    expect(await canReceiveMail('a@x.com', async () => [{ exchange: 'mx.x.com', priority: 10 }])).toBe(true);
    expect(await canReceiveMail('a@x.com', async () => [{ exchange: '.', priority: 0 }])).toBe(false);
    expect(await canReceiveMail('a@x.com', fail('ENOTFOUND') as any)).toBe(false);
    expect(await canReceiveMail('a@x.com', fail('ETIMEOUT') as any)).toBe(true);
  });
});

describe('signed tokens', () => {
  it('accepts genuine links and rejects forged, expired or wrong-purpose ones', () => {
    const now = 1_800_000_000_000;
    const t = signLink('confirm', '42', 3600, now);
    expect(verifyLink('confirm', t, now)).toBe('42');
    expect(verifyLink('unsub', t, now)).toBeNull();
    expect(verifyLink('confirm', t, now + 3601_000)).toBeNull();
    expect(verifyLink('confirm', t.replace('42.', '43.'), now)).toBeNull();
    expect(verifyLink('confirm', 'garbage', now)).toBeNull();
    expect(verifyLink('unsub', signLink('unsub', '7', 0, now), now + 1e12)).toBe('7');
  });
  it('measures the age of a form token', () => {
    const now = 1_800_000_000_000;
    expect(formAge(signForm(now), now + 5000)).toBe(5000);
    expect(formAge(`${now}.forged`, now)).toBeNull();
    expect(formAge('', now)).toBeNull();
  });
});

describe('signup', () => {
  const now = 1_800_000_000_000;
  const sent: Mail[] = [];
  const deps = { send: async (m: Mail) => void sent.push(m), mxOk: async () => true, now };
  const attempt = (over: Partial<Parameters<typeof handleSignup>[0]> = {}, d: object = {}) =>
    handleSignup({ email: 'pat@example.com', trap: '', formToken: signForm(now - 10_000), ip: '1.2.3.4', ...over }, { ...deps, ...d });
  beforeEach(() => void (sent.length = 0));

  it('sends one confirmation and subscribes only after it is confirmed', async () => {
    const r = await attempt();
    expect(r).toMatchObject({ status: 200, ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('pat@example.com');
    const token = decodeURIComponent(sent[0].text.match(/token=(\S+)/)![1]);
    expect(await subscriberCounts()).toEqual({ pending: 1 });
    const id = verifyLink('confirm', token, now)!;
    expect(await confirmSubscriber(id)).toBe(true);
    expect(await subscriberCounts()).toEqual({ confirmed: 1 });
  });

  it('will not email the same address again within 15 minutes, or once confirmed', async () => {
    await attempt();
    const again = await attempt({ ip: '9.9.9.9' });
    expect(again).toMatchObject({ status: 200, ok: true }); // same reply, so nothing is revealed
    expect(sent).toHaveLength(1);
    await confirmSubscriber('1');
    await pg.exec("UPDATE email_subscribers SET last_confirm_sent_at = now() - interval '1 hour'");
    await attempt({ ip: '8.8.8.8' });
    expect(sent).toHaveLength(1);
  });

  it('resends after 15 minutes while still unconfirmed', async () => {
    await attempt();
    await pg.exec("UPDATE email_subscribers SET last_confirm_sent_at = now() - interval '16 minutes'");
    await attempt();
    expect(sent).toHaveLength(2);
  });

  it('drops bots quietly: trap field filled or form submitted instantly', async () => {
    expect(await attempt({ trap: 'Acme Inc' })).toMatchObject({ status: 200, ok: true });
    expect(await attempt({ formToken: signForm(now - (MIN_FORM_MS - 500)) })).toMatchObject({ status: 200, ok: true });
    expect(sent).toHaveLength(0);
    await ensureEmailTables();
    expect(await subscriberCounts()).toEqual({});
  });

  it('rejects forged or missing form tokens and bad addresses', async () => {
    expect((await attempt({ formToken: 'x.y' })).status).toBe(400);
    expect((await attempt({ formToken: undefined })).status).toBe(400);
    expect((await attempt({ email: 'not-an-email' })).status).toBe(400);
    expect((await attempt({ email: 'x@mailinator.com' })).status).toBe(400);
    expect((await attempt({}, { mxOk: async () => false })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('limits signups per visitor', async () => {
    for (let i = 0; i < 5; i++) expect((await attempt({ email: `p${i}@example.com` })).status).toBe(200);
    expect((await attempt({ email: 'p6@example.com' })).status).toBe(429);
    expect((await attempt({ email: 'p7@example.com', ip: '5.6.7.8' })).status).toBe(200);
    expect(sent).toHaveLength(6);
  });

  it('lets the person retry when the email fails to send', async () => {
    const r = await attempt({}, { send: async () => { throw new Error('SES down'); } });
    expect(r.status).toBe(502);
    await attempt({ ip: '2.2.2.2' });
    expect(sent).toHaveLength(1);
  });

  it('never emails a blocked address, and unsubscribe sticks until they sign up again', async () => {
    await ensureEmailTables();
    await suppress('pat@example.com', 'complaint');
    await attempt();
    expect(sent).toHaveLength(0);
    expect(await unsubscribe('1')).toBe(false); // blocked stays blocked
    expect(await confirmSubscriber('1')).toBe(false);

    await attempt({ email: 'sam@example.com', ip: '3.3.3.3' });
    await confirmSubscriber('2');
    expect(await unsubscribe('2')).toBe(true);
    expect(await subscriberCounts()).toEqual({ suppressed: 1, unsubscribed: 1 });
  });
});

describe('housekeeping and limits', () => {
  it('refuses once the limit is reached and purges stale rows', async () => {
    await ensureEmailTables();
    expect(await allow('k', 2, 60)).toBe(true);
    expect(await allow('k', 2, 60)).toBe(true);
    expect(await allow('k', 2, 60)).toBe(false);
    await pg.exec("UPDATE email_rate SET at = now() - interval '2 days'");
    expect(await allow('k', 2, 60)).toBe(true);
    await pg.exec("INSERT INTO email_subscribers (email, created_at) VALUES ('old@example.com', now() - interval '8 days'), ('new@example.com', now())");
    await purgeStale();
    expect(await subscriberCounts()).toEqual({ pending: 1 });
    expect((await sql`SELECT count(*)::int AS n FROM email_rate`)[0].n).toBe(1);
  });
});

describe('road status history', () => {
  it('adds a row only when a road changes', async () => {
    const storm = summarize([...STORM_SAMPLE]);
    expect(await recordStatuses(storm)).toHaveLength(5);
    expect(await recordStatuses(storm)).toEqual([]);
    const cleared = storm.map((r) => (r.def.id === '330' ? { ...r, level: 'open' as const } : r));
    expect(await recordStatuses(cleared)).toEqual(['330']);
  });
});

describe('Amazon bounce and complaint messages', () => {
  const note = (message: object) => JSON.stringify({ Type: 'Notification', Message: JSON.stringify(message) });
  it('reads bounces, complaints and the setup handshake', () => {
    expect(parseSesEvent(note({ notificationType: 'Bounce', bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'Gone@Example.com' }] } })))
      .toEqual({ kind: 'suppress', reason: 'bounce', emails: ['gone@example.com'] });
    expect(parseSesEvent(note({ notificationType: 'Bounce', bounce: { bounceType: 'Transient', bouncedRecipients: [{ emailAddress: 'full@example.com' }] } })))
      .toEqual({ kind: 'ignore' });
    expect(parseSesEvent(note({ eventType: 'Complaint', complaint: { complainedRecipients: [{ emailAddress: 'angry@example.com' }] } })))
      .toEqual({ kind: 'suppress', reason: 'complaint', emails: ['angry@example.com'] });
    expect(parseSesEvent(JSON.stringify({ Type: 'SubscriptionConfirmation', SubscribeURL: 'https://sns.us-west-2.amazonaws.com/?Action=ConfirmSubscription' })).kind).toBe('confirm-subscription');
    expect(parseSesEvent(JSON.stringify({ Type: 'SubscriptionConfirmation', SubscribeURL: 'https://evil.example.com/sns.us-west-2.amazonaws.com' }))).toEqual({ kind: 'ignore' });
    expect(parseSesEvent('not json')).toEqual({ kind: 'ignore' });
    expect(isSnsUrl('http://sns.us-west-2.amazonaws.com/')).toBe(false);
  });
});

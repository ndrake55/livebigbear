import { createHmac } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { summarize } from './caltrans';
import { setSqlForTests, type Sql, type StatusChange } from './db';
import { DEFAULT_PREFS, isQuiet, normalizePrefs, wantsText } from './prefs';
import { STORM_SAMPLE } from './sample';
import { changeText, eventFor, maskPhone, normalizePhone, validTwilioSignature } from './sms';
import { readSession, validStripeSignature } from './stripe';
import { resetEmailTablesForTests, savePrefs, subscriberById, suppress } from './subscribers';
import {
  applyReply,
  applySubscriptionStatus,
  changePhone,
  checkCode,
  ensureTextTables,
  isTextOnly,
  linkCheckout,
  resetTextTablesForTests,
  runMorningTexts,
  runTextAlerts,
  sendCode,
  subscriberByPhone,
  textCounts,
  textState,
  verifyPhone,
} from './text-plan';

let pg: PGlite;
let sql: Sql;
beforeAll(async () => {
  process.env.EMAIL_TOKEN_SECRET = 'test-secret';
  pg = new PGlite();
  sql = async (strings, ...values) => {
    const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
    return (await pg.query(text, values as unknown[])).rows as Record<string, any>[];
  };
  setSqlForTests(sql);
});
afterAll(async () => {
  setSqlForTests(null);
  await pg.close();
});
beforeEach(async () => {
  await pg.exec('DROP TABLE IF EXISTS text_log; DROP TABLE IF EXISTS text_codes; DROP TABLE IF EXISTS email_subscribers; DROP TABLE IF EXISTS email_rate;');
  resetEmailTablesForTests();
  resetTextTablesForTests();
});

/** A stand-in for Twilio that keeps what would have been sent. */
const outbox = () => {
  const sent: { to: string; body: string }[] = [];
  const send = async (to: string, body: string) => {
    sent.push({ to, body });
  };
  const lastCode = () => /code is (\d{6})/.exec([...sent].reverse().find((m) => m.body.includes('code is'))?.body ?? '')?.[1] ?? '';
  return { sent, send, lastCode };
};

const PHONE = '+19095551234';
const paid = (over: Partial<{ email: string; phone: string; subscriberId: string; customerId: string; subscriptionId: string }> = {}) => ({
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  email: 'driver@example.com',
  phone: PHONE,
  subscriberId: '',
  created: 0,
  ...over,
});
/** Pays, texts a code and enters it. Returns the subscriber id. */
async function join(over: Parameters<typeof paid>[0] = {}): Promise<string> {
  const box = outbox();
  const linked = (await linkCheckout(paid(over)))!;
  await sendCode(linked.phone, box.send);
  expect(await verifyPhone(linked.id, box.lastCode(), box.send)).toBe(true);
  return linked.id;
}

const storm = summarize([...STORM_SAMPLE]);
// 1:00 PM, 11:30 PM and 6:30 AM Pacific on a winter Friday.
const afternoon = new Date('2027-01-15T21:00:00Z');
const night = new Date('2027-01-16T07:30:00Z');
const morning = new Date('2027-01-15T14:30:00Z');
const closed330: StatusChange[] = [{ id: '330', from: 'open', to: 'closed' }];

describe('phone numbers and wording', () => {
  it('accepts US numbers however they are typed and nothing else', () => {
    expect(normalizePhone('(909) 555-1234')).toBe(PHONE);
    expect(normalizePhone('1-909-555-1234')).toBe(PHONE);
    expect(normalizePhone('+1 909 555 1234')).toBe(PHONE);
    expect(normalizePhone('555-1234')).toBeNull();
    expect(normalizePhone('+44 20 7946 0958')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(maskPhone(PHONE)).toBe('(909) •••-1234');
  });
  it('turns a status change into the event worth a text', () => {
    expect(eventFor('open', 'closed')).toBe('closed');
    expect(eventFor('closed', 'r2')).toBe('reopened');
    expect(eventFor('open', 'r1')).toBe('chainsOn');
    expect(eventFor('r1', 'r2')).toBe('chainsOn');
    expect(eventFor('r2', 'open')).toBe('chainsOff');
    // Data going missing or coming back, and the very first reading, are not news.
    expect(eventFor('open', 'unknown')).toBeNull();
    expect(eventFor('unknown', 'closed')).toBeNull();
    expect(eventFor(null, 'closed')).toBeNull();
  });
  it('puts several changes in one short text with the way to stop', () => {
    const text = changeText([
      { id: '330', name: 'Highway 330', event: 'closed', to: 'closed' },
      { id: '38', name: 'Highway 38', event: 'chainsOn', to: 'r2' },
    ]);
    expect(text).toContain('Highway 330 CLOSED');
    expect(text).toContain('Highway 38 chains required (R2)');
    expect(text).toContain('Reply STOP');
    expect(text.length).toBeLessThan(320);
  });
});

describe('checking who is calling', () => {
  it('accepts only requests signed by Twilio', () => {
    const url = 'https://www.livebigbear.com/api/text/twilio';
    const params = { From: PHONE, Body: 'STOP' };
    const good = createHmac('sha1', 'token').update(`${url}Body${params.Body}From${params.From}`).digest('base64');
    expect(validTwilioSignature(url, params, good, 'token')).toBe(true);
    expect(validTwilioSignature(url, { ...params, Body: 'START' }, good, 'token')).toBe(false);
    expect(validTwilioSignature(url, params, good, 'other')).toBe(false);
    expect(validTwilioSignature(url, params, null, 'token')).toBe(false);
  });
  it('accepts only fresh notifications signed by Stripe', () => {
    const body = '{"type":"checkout.session.completed"}';
    const now = 1_800_000_000_000;
    const t = now / 1000;
    const v1 = createHmac('sha256', 'whsec').update(`${t}.${body}`).digest('hex');
    expect(validStripeSignature(body, `t=${t},v1=${v1}`, 'whsec', now)).toBe(true);
    expect(validStripeSignature(`${body} `, `t=${t},v1=${v1}`, 'whsec', now)).toBe(false);
    expect(validStripeSignature(body, `t=${t},v1=${v1}`, 'whsec', now + 10 * 60_000)).toBe(false);
    expect(validStripeSignature(body, `t=${t},v1=${v1}`, '', now)).toBe(false);
    expect(validStripeSignature(body, null, 'whsec', now)).toBe(false);
  });
  it('reads a checkout only once it is finished and paid', () => {
    const done = { status: 'complete', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', client_reference_id: '7', customer_details: { email: 'A@Example.com', phone: '+19095551234' }, created: 1_800_000_000 };
    expect(readSession(done)).toEqual({ customerId: 'cus_1', subscriptionId: 'sub_1', email: 'a@example.com', phone: PHONE, subscriberId: '7', created: 1_800_000_000 });
    expect(readSession({ ...done, status: 'open' })).toBeNull();
    expect(readSession({ ...done, payment_status: 'unpaid' })).toBeNull();
    expect(readSession({ ...done, client_reference_id: '7; DROP' })!.subscriberId).toBe('');
  });
});

describe('codes', () => {
  it('works once, for the right code only', async () => {
    const box = outbox();
    expect(await sendCode(PHONE, box.send)).toBe(true);
    expect(box.sent[0].to).toBe(PHONE);
    const code = box.lastCode();
    expect(await checkCode(PHONE, code === '000000' ? '000001' : '000000')).toBe(false);
    expect(await checkCode(PHONE, code)).toBe(true);
    expect(await checkCode(PHONE, code)).toBe(false);
  });
  it('locks after five wrong tries, even for the right code', async () => {
    const box = outbox();
    await sendCode(PHONE, box.send);
    const code = box.lastCode();
    const wrong = code === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) expect(await checkCode(PHONE, wrong)).toBe(false);
    expect(await checkCode(PHONE, code)).toBe(false);
  });
  it('sends at most three codes an hour to one number', async () => {
    const box = outbox();
    for (let i = 0; i < 3; i++) expect(await sendCode(PHONE, box.send)).toBe(true);
    expect(await sendCode(PHONE, box.send)).toBe(false);
    expect(box.sent).toHaveLength(3);
    expect(await sendCode('+19095550000', box.send)).toBe(true);
  });
  it('expires', async () => {
    const box = outbox();
    await sendCode(PHONE, box.send);
    await sql`UPDATE text_codes SET expires_at = now() - interval '1 minute'`;
    expect(await checkCode(PHONE, box.lastCode())).toBe(false);
  });
});

describe('paying and proving the number', () => {
  it('creates an account from the checkout with email kinds off, and asks for a code once', async () => {
    const first = (await linkCheckout(paid()))!;
    expect(first).toMatchObject({ needsCode: true, phone: PHONE });
    // Stripe reports the same checkout twice: by notification and when the customer returns.
    expect(await linkCheckout(paid())).toMatchObject({ id: first.id, needsCode: false });
    expect(await textState(first.id)).toMatchObject({ status: 'active', phone: PHONE, verified: false });
    const prefs = normalizePrefs((await subscriberById(first.id))!.prefs);
    expect(prefs).toMatchObject({ morning: false, closures: false, snow: 0, warnings: false, textClosed: true });
    // Not signed in by phone until the number is proven.
    expect(await subscriberByPhone(PHONE)).toBeNull();
  });
  it('adds the plan to an existing email subscriber and keeps their email settings', async () => {
    await ensureTextTables();
    const made = await sql`INSERT INTO email_subscribers (email, status, confirmed_at, prefs) VALUES ('driver@example.com', 'confirmed', now(), '{"roads":["330"]}'::jsonb) RETURNING id`;
    const id = String(made[0].id);
    expect((await linkCheckout(paid({ subscriberId: id, email: 'card-email@example.com' })))!.id).toBe(id);
    expect(normalizePrefs((await subscriberById(id))!.prefs)).toMatchObject({ roads: ['330'], morning: true });
  });
  it('never hands an existing email account to someone who only typed its address at the checkout', async () => {
    await ensureTextTables();
    const victim = String((await sql`INSERT INTO email_subscribers (email, status, confirmed_at) VALUES ('driver@example.com', 'confirmed', now()) RETURNING id`)[0].id);
    const linked = (await linkCheckout(paid()))!;
    expect(linked.id).not.toBe(victim);
    expect((await textState(victim)).status).toBe('none');
    expect(isTextOnly((await subscriberById(linked.id))!.email)).toBe(true);
    // The same checkout seen again lands on the same new account.
    expect((await linkCheckout(paid()))!.id).toBe(linked.id);
  });
  it('turns texts on with the code and welcomes them', async () => {
    const box = outbox();
    const linked = (await linkCheckout(paid()))!;
    await sendCode(linked.phone, box.send);
    expect(await verifyPhone(linked.id, '12', box.send)).toBe(false);
    expect(await verifyPhone(linked.id, box.lastCode(), box.send)).toBe(true);
    expect(box.sent.at(-1)!.body).toContain('text alerts are on');
    expect(await textState(linked.id)).toMatchObject({ verified: true });
    expect(await subscriberByPhone(PHONE)).toBe(linked.id);
    expect(await textCounts()).toMatchObject({ active: 1, verified: 1, stopped: 0 });
  });
  it('makes a changed number prove itself again', async () => {
    const id = await join();
    const box = outbox();
    expect(await changePhone(id, 'nonsense', box.send)).toBe('bad-number');
    expect(await changePhone(id, '909-555-9999', box.send)).toBe('ok');
    expect(await textState(id)).toMatchObject({ phone: '+19095559999', verified: false });
    expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 0 });
    expect(await verifyPhone(id, box.lastCode(), box.send)).toBe(true);
    expect(await subscriberByPhone(PHONE)).toBeNull();
  });
  it('follows Stripe when a payment fails or the plan ends', async () => {
    const id = await join();
    const box = outbox();
    await applySubscriptionStatus('sub_1', 'past_due');
    expect((await textState(id)).status).toBe('past_due');
    expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 0 });
    await applySubscriptionStatus('sub_1', 'active');
    expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 1 });
    await applySubscriptionStatus('sub_1', 'canceled');
    expect(await subscriberByPhone(PHONE)).toBeNull();
    expect(await changePhone(id, PHONE, box.send)).toBe('not-paid');
  });
  it('keeps a paying customer on their settings page even if their email bounced', async () => {
    const id = await join();
    await suppress('driver@example.com', 'bounce');
    expect(await subscriberById(id)).not.toBeNull();
    expect(await savePrefs(id, normalizePrefs({ textCap: 3 }))).toBe(true);
  });
});

describe('text settings', () => {
  it('reads quiet hours that run past midnight', () => {
    expect(isQuiet(DEFAULT_PREFS, 22)).toBe(true);
    expect(isQuiet(DEFAULT_PREFS, 3)).toBe(true);
    expect(isQuiet(DEFAULT_PREFS, 6)).toBe(false);
    expect(isQuiet({ ...DEFAULT_PREFS, quietFrom: 13, quietTo: 15 }, 14)).toBe(true);
    expect(isQuiet({ ...DEFAULT_PREFS, quietFrom: 8, quietTo: 8 }, 8)).toBe(false);
  });
  it('keeps only limits it offers', () => {
    expect(normalizePrefs({ textCap: '5', quietFrom: '22', quietTo: 7, textReopened: false })).toMatchObject({ textCap: 5, quietFrom: 22, quietTo: 7, textReopened: false });
    expect(normalizePrefs({ textCap: 500, quietFrom: 99 })).toMatchObject({ textCap: 10, quietFrom: 21 });
  });
  it('respects events, roads, days, pause and quiet hours', () => {
    const p = normalizePrefs({ roads: ['330'], textReopened: false });
    expect(wantsText(p, 'closed', '330', '2027-01-15', 5, 13)).toBe(true);
    expect(wantsText(p, 'closed', '38', '2027-01-15', 5, 13)).toBe(false);
    expect(wantsText(p, 'reopened', '330', '2027-01-15', 5, 13)).toBe(false);
    expect(wantsText(p, 'closed', '330', '2027-01-15', 5, 23)).toBe(false);
    expect(wantsText({ ...p, days: [6] }, 'closed', '330', '2027-01-15', 5, 13)).toBe(false);
    expect(wantsText({ ...p, pauseUntil: '2027-02-01' }, 'closed', '330', '2027-01-15', 5, 13)).toBe(false);
  });
});

describe('sending alert texts', () => {
  it('sends one text covering every change, only to people who proved their number', async () => {
    await join();
    await linkCheckout(paid({ email: 'unproven@example.com', phone: '+19095550001', customerId: 'cus_2', subscriptionId: 'sub_2' }));
    const box = outbox();
    const run = await runTextAlerts(storm, [...closed330, { id: '38', from: 'open', to: 'r2' }, { id: '18-front', from: 'unknown', to: 'open' }], afternoon, box.send);
    expect(run).toEqual({ sent: 1, failed: 0, capped: 0 });
    expect(box.sent).toHaveLength(1);
    expect(box.sent[0].to).toBe(PHONE);
    expect(box.sent[0].body).toContain('CLOSED');
    expect(box.sent[0].body).toContain('chains required (R2)');
  });
  it('stays quiet at night and for roads the person did not pick', async () => {
    const id = await join();
    const box = outbox();
    expect(await runTextAlerts(storm, closed330, night, box.send)).toMatchObject({ sent: 0 });
    await savePrefs(id, normalizePrefs({ roads: ['38'] }));
    expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 0 });
    expect(box.sent).toHaveLength(0);
  });
  it('stops at the daily limit', async () => {
    const id = await join();
    await savePrefs(id, normalizePrefs({ textCap: 3 }));
    const box = outbox();
    for (let i = 0; i < 4; i++) await runTextAlerts(storm, closed330, afternoon, box.send);
    expect(box.sent).toHaveLength(3);
    expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 0, capped: 1 });
  });
  it('obeys STOP and START', async () => {
    await join();
    const box = outbox();
    expect(await applyReply('+1 (909) 555-1234', ' stop ')).toBe('stopped');
    expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 0 });
    expect(await textCounts()).toMatchObject({ stopped: 1 });
    expect(await applyReply(PHONE, 'START')).toBe('started');
    expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 1 });
    expect(await applyReply(PHONE, 'thanks!')).toBe('ignored');
  });
  it('can be switched off in one place', async () => {
    await join();
    const box = outbox();
    process.env.TEXT_ALERTS = 'off';
    try {
      expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 0 });
      expect(await runMorningTexts(storm, morning, box.send)).toMatchObject({ sent: 0 });
    } finally {
      delete process.env.TEXT_ALERTS;
    }
  });
  it('sends the morning summary once, at the chosen hour, on storm days only', async () => {
    const id = await join();
    const box = outbox();
    expect(await runMorningTexts(storm, morning, box.send)).toMatchObject({ sent: 1 });
    expect(await runMorningTexts(storm, morning, box.send)).toMatchObject({ sent: 0 });
    expect(box.sent[0].body).toMatch(/^Live Big Bear: /);
    expect(box.sent[0].body).toContain('Reply STOP');
    expect(await runMorningTexts(storm, afternoon, box.send)).toMatchObject({ sent: 0 });
    await sql`DELETE FROM text_log`;
    expect(await runMorningTexts(storm.map((r) => ({ ...r, level: 'open' as const })), morning, box.send)).toMatchObject({ sent: 0 });
    await savePrefs(id, normalizePrefs({ morningHour: 7 }));
    expect(await runMorningTexts(storm, morning, box.send)).toMatchObject({ sent: 0 });
    await savePrefs(id, normalizePrefs({ textMorning: false }));
    expect(await runMorningTexts(storm, morning, box.send)).toMatchObject({ sent: 0 });
  });
});

describe('diagnosing problems', () => {
  it('keeps the latest problem for the status page, without email addresses', async () => {
    const { noteProblem, readProblem } = await import('./db');
    expect(await readProblem('checkout')).toBeNull();
    await noteProblem('checkout', 'Stripe answered 400: first');
    await noteProblem('checkout', 'Stripe answered 400: Invalid email address: driver@example.com');
    const p = (await readProblem('checkout'))!;
    expect(p.value).toBe('Stripe answered 400: Invalid email address: (address)');
    expect(p.at).toBeInstanceOf(Date);
  });
  it('spots a product ID pasted where the price ID belongs, without calling Stripe', async () => {
    const { checkPrice } = await import('./stripe');
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_PRICE_ID = 'prod_123';
    try {
      const r = await checkPrice();
      expect(r.ok).toBe(false);
      expect(r.summary).toContain('price_');
    } finally {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_PRICE_ID;
    }
  });
});

describe('refunds and disputes', () => {
  it('ends the plan for that customer only, once, and says which subscription to cancel', async () => {
    const { endPlanForCustomer } = await import('./text-plan');
    const id = await join();
    const other = await join({ email: 'other@example.com', phone: '+19095550002', customerId: 'cus_2', subscriptionId: 'sub_2' });
    expect(await endPlanForCustomer('cus_unknown')).toBe('');
    expect(await endPlanForCustomer('')).toBe('');
    expect(await endPlanForCustomer('cus_1')).toBe('sub_1');
    expect((await textState(id)).status).toBe('canceled');
    expect((await textState(other)).status).toBe('active');
    // A second notice about the same customer finds nothing left to end.
    expect(await endPlanForCustomer('cus_1')).toBe('');
    const box = outbox();
    expect(await runTextAlerts(storm, closed330, afternoon, box.send)).toMatchObject({ sent: 1 });
    expect(box.sent[0].to).toBe('+19095550002');
  });
});

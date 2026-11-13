import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { summarize } from './caltrans';
import { setSqlForTests, type Sql } from './db';
import { buildHistory } from './history';
import type { Mail } from './mailer';
import { STORM_SAMPLE } from './sample';
import { plan, resetSendLogForTests, runStormEmails, stormMail } from './storm-mail';
import { ensureEmailTables, resetEmailTablesForTests } from './subscribers';
import { STORM_WEATHER } from './weather';

const storm = summarize([...STORM_SAMPLE]);
const clear = storm.map((r) => ({ ...r, level: 'open' as const }));
// 7:30 AM, 1:00 PM and 11:30 PM Pacific on a winter day (Pacific is UTC-8 in January).
const morning = new Date('2027-01-15T15:30:00Z');
const afternoon = new Date('2027-01-15T21:00:00Z');
const night = new Date('2027-01-16T07:30:00Z');

let pg: PGlite;
beforeAll(async () => {
  process.env.EMAIL_TOKEN_SECRET = 'test-secret';
  pg = new PGlite();
  const sql: Sql = async (strings, ...values) => {
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
  await pg.exec('DROP TABLE IF EXISTS email_sends; DROP TABLE IF EXISTS email_subscribers; DROP TABLE IF EXISTS email_rate;');
  resetSendLogForTests();
  resetEmailTablesForTests();
});

describe('deciding what to send', () => {
  it('sends a morning summary only when roads are affected', () => {
    expect(plan(storm, [], morning)).toEqual({ kind: 'morning', key: 'morning:2027-01-15' });
    expect(plan(clear, [], morning).kind).toBe('none');
    expect(plan(storm, [], afternoon).kind).toBe('none');
  });
  it('alerts on a new closure by day and stays quiet at night', () => {
    const closedId = storm[0].def.id;
    const shut = storm.map((r, i) => (i === 0 ? { ...r, level: 'closed' as const } : r));
    expect(plan(shut, [closedId], afternoon)).toMatchObject({ kind: 'closure', key: `closure:2027-01-15:${closedId}` });
    expect(plan(shut, [closedId], night).kind).toBe('none');
    // A road that only changed chain level is not a closure.
    const chains = storm.find((r) => r.level !== 'closed' && r.level !== 'open');
    if (chains) expect(plan(storm, [chains.def.id], afternoon).kind).toBe('none');
  });
});

describe('the storm email', () => {
  it('names every road, the snow forecast and how to unsubscribe', () => {
    const mail = stormMail('a@example.com', 'morning', storm, STORM_WEATHER, morning, 'https://x/unsub', 'https://x/one');
    expect(mail.subject).toMatch(/^Big Bear roads this morning: /);
    for (const r of storm) expect(mail.text).toContain(r.def.name);
    expect(mail.text).toContain('https://x/unsub');
    expect(mail.html).toContain('Unsubscribe');
    expect(mail.unsubscribeUrl).toBe('https://x/one');
    expect(mail.html).not.toContain('<script');
    const shut = storm.map((r, i) => (i === 0 ? { ...r, level: 'closed' as const } : r));
    const closure = stormMail('a@example.com', 'closure', shut, null, afternoon, 'u');
    expect(closure.subject).toMatch(/^Big Bear road closed: /);
  });
});

describe('sending', () => {
  it('emails confirmed subscribers once, even if run twice', async () => {
    await ensureEmailTables();
    await pg.exec(`INSERT INTO email_subscribers (email, status) VALUES ('a@example.com','confirmed'), ('b@example.com','confirmed'), ('c@example.com','pending'), ('d@example.com','unsubscribed')`);
    const out: Mail[] = [];
    const send = async (m: Mail) => {
      if (m.to.startsWith('b@')) throw new Error('bounced');
      out.push(m);
    };
    expect(await runStormEmails(storm, [], STORM_WEATHER, morning, send)).toEqual({ sent: 1, failed: 1 });
    expect(out.map((m) => m.to)).toEqual(['a@example.com']);
    expect(out[0].unsubscribeUrl).toMatch(/\/api\/subscribe\/unsubscribe\?token=/);
    expect(await runStormEmails(storm, [], STORM_WEATHER, morning, send)).toMatchObject({ sent: 0, skipped: 'Already sent.' });
    expect(await runStormEmails(clear, [], STORM_WEATHER, morning, send)).toMatchObject({ sent: 0 });
    expect(out).toHaveLength(1);
  });
});

describe('road history', () => {
  const now = new Date('2027-01-15T20:00:00Z');
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
  it('builds spans that fill the week and counts affected days', () => {
    const h = buildHistory([{ level: 'open', at: ago(20) }, { level: 'r2', at: ago(3) }, { level: 'open', at: ago(2) }], now)!;
    expect(h.spans.map((s) => s.level)).toEqual(['open', 'r2', 'open']);
    expect(Math.round(h.spans.reduce((a, s) => a + s.percent, 0))).toBe(100);
    expect(h.affectedDays).toBeGreaterThanOrEqual(1);
    expect(h.affectedDays).toBeLessThanOrEqual(2);
    expect(h.daysCovered).toBe(7);
  });
  it('shows a gap before records began', () => {
    const h = buildHistory([{ level: 'open', at: ago(2) }], now)!;
    expect(h.spans[0].level).toBe('unknown');
    expect(h.daysCovered).toBe(2);
    expect(h.affectedDays).toBe(0);
    expect(buildHistory([], now)).toBeNull();
  });
});

import { DEFAULT_PREFS, describePrefs, normalizePrefs, PRESETS, wants } from './prefs';
import { handleSignup } from './signup';
import { savePrefs, subscriberById } from './subscribers';
import { signForm, signLink, verifyLink } from './tokens';

describe('alert settings', () => {
  it('keeps only values it understands and treats "everything" as no restriction', () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ roads: ['330', 'bogus', '38'], days: ['5', '6', 9], morning: 'on', closures: false, pauseUntil: 'soon' })).toEqual({
      roads: ['330', '38'],
      days: [5, 6],
      morning: true,
      closures: false,
      pauseUntil: '',
    });
    expect(normalizePrefs({ roads: ['330', '18-crestline', '18-front', '38', '18-back'], days: [0, 1, 2, 3, 4, 5, 6] })).toMatchObject({ roads: [], days: [] });
    expect(describePrefs(PRESETS[1].prefs)).toBe('morning summary and closure alerts for all roads, Sun, Thu, Fri, Sat');
  });
  it('decides who gets an email', () => {
    const friday = 5;
    expect(wants(DEFAULT_PREFS, 'morning', ['330'], '2027-01-15', friday)).toBe(true);
    expect(wants({ ...DEFAULT_PREFS, roads: ['38'] }, 'morning', ['330'], '2027-01-15', friday)).toBe(false);
    expect(wants({ ...DEFAULT_PREFS, roads: ['38', '330'] }, 'closure', ['330'], '2027-01-15', friday)).toBe(true);
    expect(wants({ ...DEFAULT_PREFS, days: [0, 6] }, 'morning', ['330'], '2027-01-15', friday)).toBe(false);
    expect(wants({ ...DEFAULT_PREFS, morning: false }, 'morning', ['330'], '2027-01-15', friday)).toBe(false);
    expect(wants({ ...DEFAULT_PREFS, morning: false }, 'closure', ['330'], '2027-01-15', friday)).toBe(true);
    expect(wants({ ...DEFAULT_PREFS, pauseUntil: '2027-02-01' }, 'morning', ['330'], '2027-01-15', friday)).toBe(false);
    expect(wants({ ...DEFAULT_PREFS, pauseUntil: '2027-01-15' }, 'morning', ['330'], '2027-01-15', friday)).toBe(true);
  });
  it('sends only to people whose settings match, with a settings link', async () => {
    await ensureEmailTables();
    await pg.exec(`INSERT INTO email_subscribers (email, status, prefs) VALUES
      ('all@example.com','confirmed','{}'),
      ('other-road@example.com','confirmed','{"roads":["18-back"]}'),
      ('paused@example.com','confirmed','{"pauseUntil":"2027-03-01"}'),
      ('one-road@example.com','confirmed','{"roads":["330"]}')`);
    const out: Mail[] = [];
    const res = await runStormEmails(storm, [], STORM_WEATHER, morning, async (m) => void out.push(m));
    expect(res).toEqual({ sent: 2, failed: 0 });
    expect(out.map((m) => m.to).sort()).toEqual(['all@example.com', 'one-road@example.com']);
    const one = out.find((m) => m.to.startsWith('one-road'))!;
    expect(one.text).toContain('Hwy 330');
    expect(one.text).not.toContain('Hwy 38 (');
    expect(one.text).toMatch(/alerts\/manage\?token=/);
  });
  it('saves settings only with a genuine settings link, and emails that link to people already signed up', async () => {
    await ensureEmailTables();
    await pg.exec(`INSERT INTO email_subscribers (email, status) VALUES ('me@example.com','confirmed')`);
    const id = String((await pg.query(`SELECT id FROM email_subscribers`)).rows[0] && ((await pg.query<{ id: string }>(`SELECT id FROM email_subscribers`)).rows[0].id));
    const token = signLink('manage', id, 3600);
    expect(verifyLink('manage', token)).toBe(id);
    // An unsubscribe link cannot be used to change settings, and the reverse.
    expect(verifyLink('manage', signLink('unsub', id, 3600))).toBeNull();
    expect(await savePrefs(id, normalizePrefs({ roads: ['330'] }))).toBe(true);
    expect(normalizePrefs((await subscriberById(id))!.prefs).roads).toEqual(['330']);
    const out: Mail[] = [];
    const now = Date.now();
    const again = () => handleSignup({ email: 'me@example.com', trap: '', formToken: signForm(now - 5000), ip: '1.2.3.4' }, { send: async (m) => void out.push(m), mxOk: async () => true, now });
    expect(await again()).toMatchObject({ ok: true });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('Your Live Big Bear alert settings');
    expect(out[0].text).toMatch(/alerts\/manage\?token=/);
    // A second request minutes later sends nothing more, and looks the same on screen.
    expect(await again()).toMatchObject({ ok: true });
    expect(out).toHaveLength(1);
  });
});

import { rememberedId, rememberValue } from './remember';
import storedLines from './road-lines.json';

describe('remembering a subscriber on their device', () => {
  it('accepts only a genuine, unexpired cookie', () => {
    const now = Date.now();
    const value = rememberValue('42', now);
    expect(rememberedId(value, now)).toBe('42');
    expect(rememberedId(value, now + 31 * 86_400_000)).toBeNull();
    expect(rememberedId(value.replace(/^42/, '43'), now)).toBeNull();
    expect(rememberedId(undefined)).toBeNull();
    expect(rememberedId('garbage')).toBeNull();
  });
});

describe('stored road shapes', () => {
  it('cover every road and stay inside the area', () => {
    const lines = storedLines as Record<string, number[][][]>;
    for (const id of ['330', '38', '18-crestline', '18-front', '18-back']) expect(lines[id]?.length).toBeGreaterThan(10);
    for (const piece of Object.values(lines).flat()) {
      for (const [lon, lat] of piece) {
        expect(lon).toBeGreaterThan(-117.5);
        expect(lon).toBeLessThan(-116.5);
        expect(lat).toBeGreaterThan(33.9);
        expect(lat).toBeLessThan(34.5);
      }
    }
  });
});

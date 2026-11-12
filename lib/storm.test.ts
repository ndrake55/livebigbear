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

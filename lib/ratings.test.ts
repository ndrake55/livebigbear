import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setSqlForTests, type Sql } from './db';
import { isItem, MAX_DEVICES_PER_ITEM, popularity, rate, ratingFor, ratingsFor, ratingText, resetRatingTablesForTests, myStars } from './ratings';

let pg: PGlite;
beforeAll(async () => {
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
  await pg.exec('DROP TABLE IF EXISTS item_ratings;');
  resetRatingTablesForTests();
});

describe('ratings', () => {
  it('accepts only well-formed item names', () => {
    expect(isItem('trail:pine-knot-1e01')).toBe(true);
    expect(isItem('offroad:3n16-holcomb-valley-road')).toBe(true);
    expect(isItem('camp:serrano-232249')).toBe(true);
    for (const bad of ['', 'trail:', 'lake:east-ramp', "trail:x'; DROP TABLE", 'trail:UPPER', `trail:${'a'.repeat(90)}`, 5, null]) {
      expect(isItem(bad)).toBe(false);
    }
  });

  it('counts each device once and lets it change its mind', async () => {
    const item = 'trail:pine-knot-1e01';
    expect(await ratingFor(item)).toBeNull();
    expect(await rate(item, 'a', 'ip1', 5)).toMatchObject({ ok: true, rating: { avg: 5, count: 1 }, mine: 5 });
    expect(await rate(item, 'b', 'ip2', 4)).toMatchObject({ ok: true, rating: { avg: 4.5, count: 2 } });
    expect(await rate(item, 'a', 'ip1', 1)).toMatchObject({ ok: true, rating: { avg: 2.5, count: 2 }, mine: 1 });
    expect(await myStars(item, 'a')).toBe(1);
    expect(await myStars(item, 'nobody')).toBeNull();
    expect((await ratingsFor('trail')).get(item)).toEqual({ avg: 2.5, count: 2 });
    expect((await ratingsFor('offroad')).size).toBe(0);
  });

  it('refuses bad stars and ballot stuffing from one connection', async () => {
    const item = 'trail:castle-rock-1w03';
    for (const bad of [0, 6, 2.5, NaN]) expect(await rate(item, 'a', 'ip1', bad)).toMatchObject({ ok: false, status: 400 });
    expect(await rate('nope', 'a', 'ip1', 5)).toMatchObject({ ok: false, status: 400 });
    for (let i = 0; i < MAX_DEVICES_PER_ITEM; i++) expect((await rate(item, `d${i}`, 'ip1', 5)).ok).toBe(true);
    expect(await rate(item, 'one-more', 'ip1', 5)).toMatchObject({ ok: false, status: 429 });
    // Someone who already rated can still change their rating.
    expect((await rate(item, 'd0', 'ip1', 3)).ok).toBe(true);
    expect((await ratingFor(item))?.count).toBe(MAX_DEVICES_PER_ITEM);
  });

  it('starts from our ranking and lets real ratings take over', () => {
    expect(popularity('trail', '1E01', undefined)).toBeGreaterThan(popularity('trail', '1E22', undefined));
    expect(popularity('trail', '9X99', undefined)).toBe(0);
    // Ten five-star ratings lift an unranked trail above the top of the starting order.
    expect(popularity('trail', '9X99', { avg: 5, count: 10 })).toBeGreaterThan(popularity('trail', '1E01', undefined));
    // Poor ratings pull a well-known trail down.
    expect(popularity('trail', '1E01', { avg: 1, count: 10 })).toBeLessThan(popularity('trail', '1E22', undefined));
    expect(ratingText({ avg: 4.6, count: 12 })).toBe('4.6 (12 ratings)');
    expect(ratingText({ avg: 5, count: 1 })).toBe('5.0 (1 rating)');
  });
});

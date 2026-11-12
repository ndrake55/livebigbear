import { getSql, hasDb } from './db';

/** Ratings are kept per item, e.g. "trail:pine-knot-1e01" or "offroad:3n16-holcomb-valley-road". */
const ITEM = /^(trail|offroad):[a-z0-9][a-z0-9-]{1,79}$/;
export const isItem = (v: unknown): v is string => typeof v === 'string' && ITEM.test(v);

export interface Rating {
  /** Average of visitors' stars, one decimal. */
  avg: number;
  count: number;
}

let ready: Promise<void> | null = null;
export function ensureRatingTables(): Promise<void> {
  ready ??= (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS item_ratings (
        item TEXT NOT NULL,
        voter TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
        at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (item, voter)
      )`;
    await sql`CREATE INDEX IF NOT EXISTS item_ratings_ip ON item_ratings (ip_hash, at DESC)`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
export const resetRatingTablesForTests = () => {
  ready = null;
};

/** How many ratings one connection may send in an hour, and how many devices behind it may rate one item. */
export const MAX_PER_HOUR = 30;
export const MAX_DEVICES_PER_ITEM = 3;

export type RateResult = { ok: true; rating: Rating; mine: number } | { ok: false; status: number; message: string };

/**
 * Records one visitor's stars for one item. Rating again replaces the earlier rating, so a
 * visitor counts once however many times they tap.
 */
export async function rate(item: string, voter: string, ipHash: string, stars: number): Promise<RateResult> {
  if (!isItem(item) || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, status: 400, message: 'That rating could not be read.' };
  }
  await ensureRatingTables();
  const sql = getSql();
  const mineAlready = await sql`SELECT 1 FROM item_ratings WHERE item = ${item} AND voter = ${voter}`;
  if (mineAlready.length === 0) {
    const recent = await sql`
      SELECT count(*)::int AS n FROM item_ratings
      WHERE ip_hash = ${ipHash} AND at > now() - interval '1 hour'`;
    if (recent[0].n >= MAX_PER_HOUR) return { ok: false, status: 429, message: 'That is a lot of ratings. Please try again later.' };
    const sameItem = await sql`SELECT count(*)::int AS n FROM item_ratings WHERE item = ${item} AND ip_hash = ${ipHash}`;
    if (sameItem[0].n >= MAX_DEVICES_PER_ITEM) return { ok: false, status: 429, message: 'This one has already been rated from your connection.' };
  }
  await sql`
    INSERT INTO item_ratings (item, voter, ip_hash, stars) VALUES (${item}, ${voter}, ${ipHash}, ${stars})
    ON CONFLICT (item, voter) DO UPDATE SET stars = EXCLUDED.stars, at = now()`;
  return { ok: true, rating: (await ratingFor(item)) ?? { avg: stars, count: 1 }, mine: stars };
}

const toRating = (r: Record<string, any>): Rating => ({ avg: Math.round(Number(r.avg) * 10) / 10, count: Number(r.n) });

export async function ratingFor(item: string): Promise<Rating | null> {
  await ensureRatingTables();
  const rows = await getSql()`SELECT avg(stars)::float AS avg, count(*)::int AS n FROM item_ratings WHERE item = ${item}`;
  return rows[0] && rows[0].n > 0 ? toRating(rows[0]) : null;
}

export async function myStars(item: string, voter: string): Promise<number | null> {
  await ensureRatingTables();
  const rows = await getSql()`SELECT stars FROM item_ratings WHERE item = ${item} AND voter = ${voter}`;
  return rows[0] ? Number(rows[0].stars) : null;
}

/** Every rating for one kind of item. Returns an empty map if the database cannot be reached. */
export async function ratingsFor(kind: 'trail' | 'offroad'): Promise<Map<string, Rating>> {
  if (!hasDb()) return new Map();
  try {
    await ensureRatingTables();
    const rows = await getSql()`
      SELECT item, avg(stars)::float AS avg, count(*)::int AS n FROM item_ratings
      WHERE item LIKE ${`${kind}:%`} GROUP BY item`;
    return new Map(rows.map((r) => [String(r.item), toRating(r)]));
  } catch {
    return new Map();
  }
}

/**
 * A starting order, best known first, so the popular list is useful before anyone has rated.
 * Trails: ordered by how much attention each gets in the Big Bear trail guides and review
 * sites consulted in November 2026. This is our own ranking, not anyone's star rating, and
 * visitors' ratings take over as they come in. Keyed by Forest Service trail or road number.
 */
export const STARTING_ORDER: Record<'trail' | 'offroad', string[]> = {
  trail: [
    '1E01', '1E22', '1W03', '1E12', '1E50', '1W06', '1E23', '1W11', '1E27', '2E18',
    '1E30', '1E32', '1E24', '1W05', '1E31', '1W16', '1W12', '1E29', '1E40', '0E01',
  ],
  offroad: ['3N16', '3N69', '3N10', '2N10', '3N14', '2N02', '2N13', '1N54', '3N34', '2N06'],
};

/**
 * One number to sort by. An item starts with points for its place in the starting order.
 * Each visitor rating then adds or subtracts: five stars adds 5, three adds 1, one takes away 3.
 * A handful of real ratings is enough to move an item past the starting order.
 */
export function popularity(kind: 'trail' | 'offroad', number: string, rating: Rating | undefined): number {
  const place = STARTING_ORDER[kind].indexOf(number.toUpperCase());
  const start = place === -1 ? 0 : 40 - place * 2;
  const votes = rating ? rating.count * (rating.avg - 2.5) * 2 : 0;
  return start + votes;
}

/** "4.6 (12 ratings)". */
export const ratingText = (r: Rating) => `${r.avg.toFixed(1)} (${r.count} rating${r.count === 1 ? '' : 's'})`;

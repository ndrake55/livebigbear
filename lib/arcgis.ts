/** Small helpers for the Forest Service map services (ArcGIS REST). */

/** West, south, east, north: the valley and the forest around it. */
export const FOREST_BOX = '-117.20,34.10,-116.65,34.40';

export type Row = Record<string, unknown>;

/** Field names arrive in mixed case depending on the service, so lower-case them. */
export const lowerKeys = (attrs: Row): Row =>
  Object.fromEntries(Object.entries(attrs ?? {}).map(([k, v]) => [k.toLowerCase(), v]));

export interface Feature {
  attrs: Row;
  /** Line geometry as [lon, lat] pairs, when asked for. */
  paths: number[][][];
}

export function parseFeatures(json: unknown): Feature[] {
  const list = (json as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(list)) return [];
  return list.map((f) => {
    const g = (f as { geometry?: { paths?: number[][][] } })?.geometry;
    return { attrs: lowerKeys(((f as { attributes?: Row })?.attributes ?? {}) as Row), paths: Array.isArray(g?.paths) ? g.paths : [] };
  });
}

/** Every record of a layer inside the forest box, following the service's paging. */
export async function queryBox(base: string, opts: { fields?: string; geometry?: boolean; maxPages?: number } = {}): Promise<Feature[]> {
  const out: Feature[] = [];
  const pages = opts.maxPages ?? 4;
  for (let page = 0; page < pages; page++) {
    const q = new URLSearchParams({
      where: '1=1',
      geometry: FOREST_BOX,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: opts.fields ?? '*',
      returnGeometry: opts.geometry ? 'true' : 'false',
      outSR: '4326',
      resultOffset: String(out.length),
      f: 'json',
    });
    if (opts.geometry) {
      q.set('geometryPrecision', '4');
      q.set('maxAllowableOffset', '0.0005');
    }
    const res = await fetch(`${base}/query?${q}`, {
      headers: { 'User-Agent': 'LiveBigBear/0.8 (livebigbear.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 21600 },
    });
    if (!res.ok) throw new Error(`Forest Service answered ${res.status}`);
    const json = await res.json();
    if (json?.error) throw new Error(String(json.error.message ?? 'Forest Service error').slice(0, 160));
    const got = parseFeatures(json);
    out.push(...got);
    if (!json?.exceededTransferLimit || got.length === 0) break;
  }
  return out;
}

export const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
export const number = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

/** "SANTA ANA RIVER TRAIL" becomes "Santa Ana River Trail"; "PCT" and road numbers stay as they are. */
export function tidyTitle(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => {
      if (/\d/.test(w) || /^(PCT|OHV|ATV|NRT|II|III|IV)$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Is a season such as "05/01-11/30" open on a given day? Seasons can wrap the new year
 * ("11/15-03/31"), and several can be listed. Returns null when the text is not a season.
 */
export function seasonOpen(season: string, month: number, day: number): boolean | null {
  const ranges = [...season.matchAll(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/g)];
  if (ranges.length === 0) return null;
  const today = month * 100 + day;
  return ranges.some((m) => {
    const from = Number(m[1]) * 100 + Number(m[2]);
    const to = Number(m[3]) * 100 + Number(m[4]);
    return from <= to ? today >= from && today <= to : today >= from || today <= to;
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "05/01-11/30" becomes "May 1 to Nov 30"; a full year becomes "all year". */
export function seasonText(season: string): string {
  const m = season.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
  if (!m) return '';
  const [a, b, c, d] = m.slice(1).map(Number);
  if (a === 1 && b === 1 && c === 12 && d === 31) return 'all year';
  if (!MONTHS[a - 1] || !MONTHS[c - 1]) return '';
  return `${MONTHS[a - 1]} ${b} to ${MONTHS[c - 1]} ${d}`;
}

export function pacificMonthDay(now: Date): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric' }).formatToParts(now);
  return { month: Number(parts.find((p) => p.type === 'month')?.value), day: Number(parts.find((p) => p.type === 'day')?.value) };
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Where a line starts, for directions: the loose end nearest to `near`. A loose end is a point
 * where only one segment stops, so joints between segments are not counted.
 */
export function startOf(paths: number[][][], near: { lat: number; lon: number }): { lat: number; lon: number } | null {
  const key = (c: number[]) => `${c[0].toFixed(3)},${c[1].toFixed(3)}`;
  const ends = paths.filter((p) => p.length > 0).flatMap((p) => [p[0], p[p.length - 1]]);
  if (ends.length === 0) return null;
  const count = new Map<string, number>();
  for (const e of ends) count.set(key(e), (count.get(key(e)) ?? 0) + 1);
  const loose = ends.filter((e) => count.get(key(e)) === 1);
  const pool = loose.length > 0 ? loose : ends;
  const dist = (c: number[]) => (c[1] - near.lat) ** 2 + ((c[0] - near.lon) * 0.83) ** 2;
  const best = pool.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  return { lon: best[0], lat: best[1] };
}

/** Opens turn-by-turn directions in the phone's map app. */
export const directionsUrl = (to: { lat: number; lon: number } | string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${typeof to === 'string' ? encodeURIComponent(to) : `${to.lat},${to.lon}`}`;

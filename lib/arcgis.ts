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

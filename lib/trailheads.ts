import { FOREST_BOX, lowerKeys, number, text } from './arcgis';

export interface Trailhead {
  lat: number;
  lon: number;
  /** Where to park or start, in plain words. */
  where: string;
  /** Something a visitor must know before going, if any. */
  notice?: string;
}

/**
 * Trailheads looked up by hand on the San Bernardino National Forest's own trail pages
 * (fs.usda.gov/r05/sanbernardino/recreation/trails), November 2026. Keyed by trail number.
 * Trailheads rarely move, so this list is fixed; add to it as more are checked.
 */
export const KNOWN_TRAILHEADS: Record<string, Trailhead> = {
  '1E01': { lat: 34.236115, lon: -116.927426, where: 'Aspen Glen Picnic Area on Mill Creek Road' },
  '1E01.1': { lat: 34.236111, lon: -116.926111, where: 'Aspen Glen Picnic Area on Mill Creek Road' },
  // Cabin 89 starts partway up Pine Knot Trail, so directions go to the Pine Knot parking.
  '1E24': { lat: 34.236115, lon: -116.927426, where: 'Park at Aspen Glen Picnic Area and follow Pine Knot Trail to the junction' },
  '1E27': { lat: 34.23541, lon: -116.898987, where: 'Forest Road 2N08, east of Knickerbocker Road. Park at the gate when it is closed.' },
  '1E40': { lat: 34.234133, lon: -116.897831, where: 'Lower end at the junction with Towne Trail; the top is at the Snow Summit chair lift' },
  '1E12': { lat: 34.217418, lon: -116.879727, where: 'Junction of Forest Roads 2N10 and 2N06' },
  '1E22': { lat: 34.264863, lon: -116.912204, where: 'North Shore Drive, 0.6 mile west of the Big Bear Discovery Center' },
  '1E23': { lat: 34.263232, lon: -116.891305, where: 'North Shore Drive, a quarter mile west of Stanfield Cutoff' },
  '1E50': { lat: 34.261244, lon: -116.887841, where: 'East end on North Shore Drive at Stanfield Cutoff' },
  '1E50.1': { lat: 34.263625, lon: -116.905719, where: 'Big Bear Discovery Center on North Shore Drive' },
  '1W03': { lat: 34.236759, lon: -116.961575, where: 'Hwy 18, 1.1 miles east of the dam. Limited parking in a turnout 50 yards east.' },
  '1W06': {
    lat: 34.263133,
    lon: -116.950597,
    where: 'North Shore Drive just west of Fawnskin, across from Grout Bay Picnic Area',
    notice: 'This trailhead closes in winter and spring to protect nesting bald eagles. Check with the Big Bear Discovery Center first.',
  },
  // Added from a second pass over the Forest Service trail pages.
  '0E01': { lat: 34.215149, lon: -116.92253, where: 'Forest Road 2N10, about 4 miles past Aspen Glen. The trailhead sign is on the right.' },
  '1E25': { lat: 34.227281, lon: -116.904815, where: 'Start of the trail as listed by the Forest Service; it is reached from other trails' },
  '1E29': { lat: 34.217455, lon: -116.8797, where: 'Junction of Mill Creek Road 2N10 and Radford Truck Trail 2N06' },
  '1E30': { lat: 34.230155, lon: -116.86951, where: 'Start of the trail as listed by the Forest Service; it is reached from Pirates trail' },
  '1E31': { lat: 34.23571, lon: -116.876047, where: 'Forest Road 2N99, just west of the Bristlecone trailhead' },
  '1E32': { lat: 34.235754, lon: -116.871162, where: 'Along the bottom of Snow Summit, near Pineknot Campground' },
  '1E51': { lat: 34.263279, lon: -116.905563, where: 'Behind the Big Bear Discovery Center on North Shore Drive' },
  '1W05': { lat: 34.286726, lon: -116.975191, where: 'Hanna Flat Campground, between sites 54 and 55, when the campground is open. You can also start from the Grays Peak trailhead.' },
  '1W11': { lat: 34.215266, lon: -116.975018, where: 'Forest Road 2N11, one mile off Forest Road 2N10. These dirt roads close to vehicles in winter.' },
  '1W12': { lat: 34.209514, lon: -116.944591, where: "Where Clark's Grade Road meets Skyline Road" },
  // Bluff Mesa and Siberia Creek both start from the Champion Lodgepole trailhead.
  '1W16': { lat: 34.215266, lon: -116.975018, where: 'Park at the Champion Lodgepole trailhead on Forest Road 2N11. These dirt roads close to vehicles in winter.' },
  '1W04': { lat: 34.215266, lon: -116.975018, where: 'Shares the Champion Lodgepole trailhead on Forest Road 2N11. These dirt roads close to vehicles in winter.' },
  '2E18': { lat: 34.218711, lon: -116.805989, where: 'Forest Road 2N93, off Hwy 38 at Hatchery Road. The dirt road is rough.' },
};

const RECREATION_URL = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_RecreationOpportunities_01/MapServer/0';

/** Trail and road numbers as the Forest Service writes them: 1E01, 1E01.1, 3N16, 2N70Y. */
export function numberIn(name: string): string {
  return name.toUpperCase().match(/\b(\d[NEWS]\d{2}[A-Z]?(?:\.\d+)?)\b/)?.[1] ?? '';
}

export interface Listed {
  number: string;
  name: string;
  lat: number;
  lon: number;
}

/** Reads the Forest Service's list of recreation sites and keeps those named for a trail or road number. */
export function parseListed(json: unknown): Listed[] {
  const list = (json as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(list)) return [];
  const out: Listed[] = [];
  for (const f of list) {
    const a = lowerKeys(((f as { attributes?: Record<string, unknown> })?.attributes ?? {}) as Record<string, unknown>);
    const g = (f as { geometry?: { x?: number; y?: number } })?.geometry;
    const name = text(a.recareaname ?? a.name ?? a.site_name);
    const no = numberIn(name);
    const lat = number(a.latitude) ?? number(g?.y);
    const lon = number(a.longitude) ?? number(g?.x);
    if (!no || lat === null || lon === null || Math.abs(lat) < 1) continue;
    out.push({ number: no, name, lat, lon: lon > 0 ? -lon : lon });
  }
  return out;
}

export interface ListedData {
  ok: boolean;
  note: string;
  byNumber: Map<string, Listed>;
}

/** Trailheads from the Forest Service's recreation site list, to fill in any not checked by hand. */
export async function getListed(): Promise<ListedData> {
  try {
    const q = new URLSearchParams({
      where: '1=1',
      geometry: FOREST_BOX,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    });
    const res = await fetch(`${RECREATION_URL}/query?${q}`, {
      headers: { 'User-Agent': 'LiveBigBear/0.9 (livebigbear.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`answered ${res.status}`);
    const json = await res.json();
    if (json?.error) throw new Error(String(json.error.message ?? 'error').slice(0, 160));
    const listed = parseListed(json);
    const first = json?.features?.[0]?.attributes;
    return {
      ok: true,
      note: `${json?.features?.length ?? 0} sites, ${listed.length} named for a trail or road number. First record: ${first ? JSON.stringify(first).slice(0, 300) : 'none'}`,
      byNumber: new Map(listed.map((l) => [l.number, l])),
    };
  } catch (e) {
    return { ok: false, note: e instanceof Error ? e.message : 'error', byNumber: new Map() };
  }
}

export interface Start {
  lat: number;
  lon: number;
  /** "checked": from the hand-checked list. "listed": the Forest Service site list. "guess": nearest end of the line. */
  kind: 'checked' | 'listed' | 'guess';
  where: string;
  notice?: string;
}

export function startFor(no: string, listed: Map<string, Listed>, guess: { lat: number; lon: number } | null): Start | null {
  const key = no.toUpperCase();
  const known = KNOWN_TRAILHEADS[key];
  if (known) return { ...known, kind: 'checked' };
  const l = listed.get(key);
  if (l) return { lat: l.lat, lon: l.lon, kind: 'listed', where: '' };
  return guess ? { ...guess, kind: 'guess', where: '' } : null;
}

// CAL FIRE incident feed. Listed on https://www.fire.ca.gov/incidents under "Data access for
// software developers". CAL FIRE says the data is a reference only and is not meant for
// up-to-the-minute evacuation or fire behavior information.
export const FIRES_URL =
  process.env.CALFIRE_URL ?? 'https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List?inactive=false';

/** Middle of the valley. */
const HOME = { lat: 34.2439, lon: -116.9114 };
/** How far out to look, in miles. Covers the mountain and the routes up to it. */
export const FIRE_RADIUS_MILES = 40;

export interface Fire {
  id: string;
  name: string;
  lat: number;
  lon: number;
  miles: number;
  direction: string; // "southwest"
  acres: number | null;
  contained: number | null; // percent
  county: string;
  url: string;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function directionTo(from: { lat: number; lon: number }, to: { lat: number; lon: number }): string {
  const y = Math.sin(((to.lon - from.lon) * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180);
  const x =
    Math.cos((from.lat * Math.PI) / 180) * Math.sin((to.lat * Math.PI) / 180) -
    Math.sin((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.cos(((to.lon - from.lon) * Math.PI) / 180);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(bearing / 45) % 8];
}

/** Read a field whatever capitalisation the feed uses. */
function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const n of names) {
    const key = lower.get(n.toLowerCase());
    if (key !== undefined && row[key] !== null && row[key] !== undefined) return row[key];
  }
  return undefined;
}

/** Active incidents within the radius, nearest first. Accepts the plain list or the GeoJSON form. */
export function parseFires(json: unknown, radius = FIRE_RADIUS_MILES): Fire[] {
  let rows: unknown[] = [];
  if (Array.isArray(json)) rows = json;
  else if (Array.isArray((json as { features?: unknown[] } | null)?.features)) {
    rows = (json as { features: { properties?: unknown }[] }).features.map((f) => f?.properties);
  }
  const out: Fire[] = [];
  rows.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const row = raw as Record<string, unknown>;
    const lat = num(pick(row, 'Latitude'));
    const lon = num(pick(row, 'Longitude'));
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    const active = pick(row, 'IsActive');
    if (active === false || String(active).toLowerCase() === 'false') return;
    const miles = milesBetween(HOME, { lat, lon });
    if (miles > radius) return;
    const path = String(pick(row, 'Url') ?? '');
    const url = /^https:\/\//.test(path)
      ? path
      : path.startsWith('/')
        ? `https://www.fire.ca.gov${path}`
        : 'https://www.fire.ca.gov/incidents';
    out.push({
      id: String(pick(row, 'UniqueId') ?? i),
      name: String(pick(row, 'Name') ?? 'Incident').trim() || 'Incident',
      lat,
      lon,
      miles: Math.round(miles),
      direction: directionTo(HOME, { lat, lon }),
      acres: num(pick(row, 'AcresBurned')),
      contained: num(pick(row, 'PercentContained')),
      county: String(pick(row, 'County') ?? ''),
      url,
    });
  });
  return out.sort((a, b) => a.miles - b.miles);
}

export function describeFire(f: Fire): string {
  const bits = [`${f.miles} mi ${f.direction} of Big Bear Lake`];
  if (f.acres !== null) bits.push(`${Math.round(f.acres).toLocaleString('en-US')} acres`);
  if (f.contained !== null) bits.push(`${Math.round(f.contained)}% contained`);
  return bits.join(' · ');
}

export async function getFires(): Promise<{ ok: boolean; error?: string; fires: Fire[] }> {
  try {
    const res = await fetch(FIRES_URL, {
      headers: { 'User-Agent': 'LiveBigBear/0.7 (livebigbear.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`CAL FIRE answered ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json) && !Array.isArray(json?.features)) throw new Error('CAL FIRE feed had an unexpected shape');
    return { ok: true, fires: parseFires(json) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error', fires: [] };
  }
}

/** A made-up incident for the ?demo=storm preview. */
export const SAMPLE_FIRE: Fire = {
  id: 'sample',
  name: 'Sample Fire (preview only)',
  lat: 34.14,
  lon: -117.1,
  miles: 13,
  direction: 'southwest',
  acres: 1250,
  contained: 35,
  county: 'San Bernardino',
  url: 'https://www.fire.ca.gov/incidents',
};

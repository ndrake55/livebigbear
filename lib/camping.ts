import { milesBetween } from './fires';

// Campground list from Recreation.gov's Recreation Information Database (RIDB).
// Free with a key: RIDB_API_KEY. Data source: Recreation.gov.
const RIDB = 'https://ridb.recreation.gov/api/v1';
const NWS = 'https://api.weather.gov';
const HOME = { lat: 34.2439, lon: -116.9114 };
const RADIUS_MILES = 20;

export interface Campground {
  id: string;
  name: string;
  lat: number;
  lon: number;
  miles: number;
  reservable: boolean;
  kind: string;
  url: string;
  tonight: { low: number; short: string; name: string } | null;
}

/** RIDB writes names in capitals. "HANNA FLAT" reads better as "Hanna Flat". */
export function tidyName(name: string): string {
  const small = new Set(['of', 'the', 'and', 'at', 'in']);
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function parseCampgrounds(json: unknown): Omit<Campground, 'tonight'>[] {
  const rows = (json as { RECDATA?: unknown[] } | null)?.RECDATA;
  if (!Array.isArray(rows)) return [];
  const out: Omit<Campground, 'tonight'>[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const lat = Number(r.FacilityLatitude);
    const lon = Number(r.FacilityLongitude);
    const id = String(r.FacilityID ?? '').trim();
    const name = String(r.FacilityName ?? '').trim();
    const kind = String(r.FacilityTypeDescription ?? '').trim();
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;
    if (r.Enabled === false) continue;
    if (kind && !/camp/i.test(kind)) continue;
    const miles = milesBetween(HOME, { lat, lon });
    if (miles > RADIUS_MILES) continue;
    out.push({
      id,
      name: tidyName(name),
      lat,
      lon,
      miles: Math.round(miles * 10) / 10,
      reservable: r.Reservable === true,
      kind: kind || 'Campground',
      url: `https://www.recreation.gov/camping/campgrounds/${encodeURIComponent(id)}`,
    });
  }
  return out.sort((a, b) => a.miles - b.miles);
}

const nwsHeaders = () => ({
  'User-Agent': `LiveBigBear/0.9 (livebigbear.com, ${process.env.NWS_CONTACT_EMAIL ?? 'no contact set'})`,
  Accept: 'application/geo+json',
});

/** Tonight's forecast low at one spot. Quietly returns null if the weather service does not answer. */
async function tonightAt(lat: number, lon: number): Promise<Campground['tonight']> {
  try {
    const p = await fetch(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: nwsHeaders(),
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 86400 },
    });
    if (!p.ok) return null;
    const url = (await p.json())?.properties?.forecast;
    if (!url) return null;
    const f = await fetch(url, { headers: nwsHeaders(), signal: AbortSignal.timeout(7000), next: { revalidate: 3600 } });
    if (!f.ok) return null;
    const periods: any[] = (await f.json())?.properties?.periods ?? [];
    const night = periods.find((x) => x?.isDaytime === false);
    if (!night || typeof night.temperature !== 'number') return null;
    return { low: night.temperature, short: String(night.shortForecast ?? ''), name: String(night.name ?? 'Tonight') };
  } catch {
    return null;
  }
}

export async function getCampgrounds(): Promise<{ configured: boolean; ok: boolean; error?: string; campgrounds: Campground[] }> {
  const key = process.env.RIDB_API_KEY ?? '';
  if (!key) return { configured: false, ok: false, campgrounds: [] };
  try {
    const url = `${RIDB}/facilities?latitude=${HOME.lat}&longitude=${HOME.lon}&radius=${RADIUS_MILES}&activity=CAMPING&limit=50&offset=0`;
    const res = await fetch(url, {
      headers: { apikey: key, Accept: 'application/json' },
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 21600 },
    });
    if (!res.ok) throw new Error(`Recreation.gov answered ${res.status}`);
    const list = parseCampgrounds(await res.json()).slice(0, 24);
    const tonight = await Promise.all(list.map((c) => tonightAt(c.lat, c.lon)));
    return { configured: true, ok: true, campgrounds: list.map((c, i) => ({ ...c, tonight: tonight[i] })) };
  } catch (e) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : 'Unknown error', campgrounds: [] };
  }
}

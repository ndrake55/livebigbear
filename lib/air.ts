// Air quality from AirNow (EPA). Free with a key: AIRNOW_API_KEY.
// AirNow replaced its web services in June 2026 and retired the old ones on September 30, 2026.
// These are the current addresses. The ZIP parameter is spelled differently on each, so both
// spellings are sent.
const BASE = 'https://www.airnowapi.org';
/** Big Bear Lake. AirNow answers for the reporting area that covers this ZIP code. */
const ZIP = '92315';

export interface AirReading {
  aqi: number | null; // null when only a category was issued
  category: string; // "Good", "Moderate", ...
  level: number; // 1 Good ... 6 Hazardous, 0 unknown
  pollutant: string;
  area: string;
}

export interface Air {
  configured: boolean;
  ok: boolean;
  error?: string;
  now: AirReading | null;
  tomorrow: AirReading | null;
}

const LEVELS = ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'];

function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase().replace(/[^a-z0-9]/g, ''), k]));
  for (const n of names) {
    const key = lower.get(n.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (key !== undefined && row[key] !== null && row[key] !== undefined) return row[key];
  }
  return undefined;
}

function toReading(raw: unknown): (AirReading & { date: string }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const cat = pick(row, 'Category');
  const catObj = cat && typeof cat === 'object' ? (cat as Record<string, unknown>) : {};
  const name = String(pick(catObj, 'Name') ?? pick(row, 'CategoryName') ?? (typeof cat === 'string' ? cat : '')).trim();
  const num = Number(pick(catObj, 'Number') ?? pick(row, 'CategoryNumber') ?? 0);
  const aqiRaw = Number(pick(row, 'AQI'));
  const aqi = Number.isFinite(aqiRaw) && aqiRaw >= 0 ? Math.round(aqiRaw) : null;
  let level = Number.isFinite(num) && num >= 1 && num <= 6 ? num : LEVELS.findIndex((l) => l.toLowerCase() === name.toLowerCase()) + 1;
  if (!level && aqi !== null) level = aqi <= 50 ? 1 : aqi <= 100 ? 2 : aqi <= 150 ? 3 : aqi <= 200 ? 4 : aqi <= 300 ? 5 : 6;
  if (!level && aqi === null) return null;
  return {
    aqi,
    category: name || LEVELS[level - 1] || 'Unknown',
    level,
    pollutant: String(pick(row, 'ParameterName', 'Parameter') ?? '').trim(),
    area: String(pick(row, 'ReportingArea') ?? '').trim(),
    date: String(pick(row, 'DateForecast', 'DateValid', 'DateObserved') ?? '').trim().slice(0, 10),
  };
}

const rowsOf = (json: unknown): unknown[] =>
  Array.isArray(json) ? json : Array.isArray((json as { Data?: unknown[] } | null)?.Data) ? (json as { Data: unknown[] }).Data : [];

/** The overall reading is the worst pollutant: that is how the AQI is defined. */
const worst = <T extends AirReading>(list: T[]): T | null =>
  list.length ? list.reduce((a, b) => (b.level > a.level || (b.level === a.level && (b.aqi ?? -1) > (a.aqi ?? -1)) ? b : a)) : null;

export function parseObservations(json: unknown): AirReading | null {
  const w = worst(rowsOf(json).map(toReading).filter((r): r is AirReading & { date: string } => r !== null));
  if (!w) return null;
  const { date: _date, ...reading } = w;
  return reading;
}

/** Tomorrow's forecast, given today's date as yyyy-mm-dd in Pacific time. */
export function parseForecast(json: unknown, today: string): AirReading | null {
  const all = rowsOf(json).map(toReading).filter((r): r is AirReading & { date: string } => r !== null);
  const future = [...new Set(all.map((r) => r.date).filter((d) => d > today))].sort();
  if (future.length === 0) return null;
  const w = worst(all.filter((r) => r.date === future[0]));
  if (!w) return null;
  const { date: _date, ...reading } = w;
  return reading;
}

async function get(path: string, key: string): Promise<unknown> {
  const url = `${BASE}${path}?format=application/json&zipCode=${ZIP}&zipcode=${ZIP}&distance=50&API_KEY=${encodeURIComponent(key)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`AirNow answered ${res.status}`);
  return res.json();
}

export async function getAir(): Promise<Air> {
  const key = process.env.AIRNOW_API_KEY ?? '';
  if (!key) return { configured: false, ok: false, now: null, tomorrow: null };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  const [obs, fc] = await Promise.allSettled([get('/aq/observation/current/ziplatlong/', key), get('/aq/forecast/current/', key)]);
  const now = obs.status === 'fulfilled' ? parseObservations(obs.value) : null;
  const tomorrow = fc.status === 'fulfilled' ? parseForecast(fc.value, today) : null;
  if (!now && !tomorrow) {
    const why =
      obs.status === 'rejected'
        ? obs.reason instanceof Error
          ? obs.reason.message
          : 'request failed'
        : 'AirNow answered, but with no readings for this area';
    return { configured: true, ok: false, error: why, now: null, tomorrow: null };
  }
  return { configured: true, ok: true, now, tomorrow };
}

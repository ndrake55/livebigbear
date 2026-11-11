import type { Community } from './communities';

// National Weather Service API. Free, no key, but requests must identify the app.
// Docs: https://www.weather.gov/documentation/services-web-api
const NWS = 'https://api.weather.gov';
/** Big Bear City Airport automated weather station. */
export const AIRPORT_STATION = 'KL35';

export interface Period {
  name: string;
  temperature: number | null;
  unit: string;
  wind: string;
  short: string;
  isDaytime: boolean;
}

export interface Observation {
  tempF: number | null;
  windMph: number | null;
  windFrom: string;
  text: string;
  at: string; // ISO
}

export interface WeatherAlert {
  event: string;
  headline: string;
}

export interface Weather {
  ok: boolean;
  error?: string;
  periods: Period[];
  snow24hIn: number | null;
  observation: Observation | null;
  alerts: WeatherAlert[];
}

const headers = () => ({
  'User-Agent': `LiveBigBear/0.2 (livebigbear.com, ${process.env.NWS_CONTACT_EMAIL ?? 'no contact set'})`,
  Accept: 'application/geo+json',
});

async function get(url: string, revalidate: number): Promise<any> {
  const res = await fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(8000),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Weather service answered ${res.status}`);
  return res.json();
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function compass(deg: number | null): string {
  if (deg === null) return '';
  const names = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export function parsePeriods(json: any): Period[] {
  const list = json?.properties?.periods;
  if (!Array.isArray(list)) return [];
  return list.map((p: any) => ({
    name: String(p?.name ?? ''),
    temperature: numOrNull(p?.temperature),
    unit: String(p?.temperatureUnit ?? 'F'),
    wind: [p?.windSpeed, p?.windDirection].filter(Boolean).join(' '),
    short: String(p?.shortForecast ?? ''),
    isDaytime: Boolean(p?.isDaytime),
  }));
}

/** ISO 8601 duration like PT6H or P1DT6H, in hours. */
export function durationHours(d: string): number {
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
}

/**
 * Forecast snowfall over the next 24 hours, in inches, from the gridpoint data.
 * Each value covers an interval; intervals that only partly fall in the window count in proportion.
 */
export function snowNext24h(json: any, now: Date): number | null {
  const snow = json?.properties?.snowfallAmount;
  const values = snow?.values;
  if (!Array.isArray(values)) return null;
  const start = now.getTime();
  const end = start + 24 * 3600 * 1000;
  let mm = 0;
  for (const v of values) {
    const [iso, dur] = String(v?.validTime ?? '').split('/');
    const from = Date.parse(iso);
    const hours = durationHours(dur ?? '');
    const amount = numOrNull(v?.value);
    if (!Number.isFinite(from) || hours <= 0 || amount === null) continue;
    const to = from + hours * 3600 * 1000;
    const overlap = Math.min(to, end) - Math.max(from, start);
    if (overlap > 0) mm += amount * (overlap / (to - from));
  }
  const unit = String(snow?.uom ?? '');
  const inches = unit.endsWith(':m') ? mm * 39.3701 : unit.endsWith(':cm') ? mm / 2.54 : mm / 25.4;
  return Math.round(inches * 10) / 10;
}

export function parseObservation(json: any): Observation | null {
  const p = json?.properties;
  if (!p) return null;
  const c = numOrNull(p.temperature?.value);
  const wind = numOrNull(p.windSpeed?.value);
  const windUnit = String(p.windSpeed?.unitCode ?? '');
  const windMph = wind === null ? null : windUnit.includes('m_s') ? wind * 2.23694 : wind * 0.621371;
  if (c === null && windMph === null && !p.textDescription) return null;
  return {
    tempF: c === null ? null : Math.round((c * 9) / 5 + 32),
    windMph: windMph === null ? null : Math.round(windMph),
    windFrom: compass(numOrNull(p.windDirection?.value)),
    text: String(p.textDescription ?? ''),
    at: String(p.timestamp ?? ''),
  };
}

export function parseAlerts(json: any): WeatherAlert[] {
  const list = json?.features;
  if (!Array.isArray(list)) return [];
  return list
    .map((f: any) => ({
      event: String(f?.properties?.event ?? ''),
      headline: String(f?.properties?.headline ?? ''),
    }))
    .filter((a) => a.event);
}

/** An observation older than this is not shown as "now". */
export const isFresh = (obs: Observation | null, now: Date) =>
  !!obs && Number.isFinite(Date.parse(obs.at)) && now.getTime() - Date.parse(obs.at) < 2 * 3600 * 1000;

export async function getWeather(c: Community): Promise<Weather> {
  const empty: Weather = { ok: false, periods: [], snow24hIn: null, observation: null, alerts: [] };
  try {
    // The grid cell for a spot never changes, so this lookup is kept for a day.
    const point = await get(`${NWS}/points/${c.lat},${c.lon}`, 86400);
    const forecastUrl = point?.properties?.forecast;
    const gridUrl = point?.properties?.forecastGridData;
    if (!forecastUrl) throw new Error('Weather service returned no forecast link');
    const [forecast, grid, obs, alerts] = await Promise.allSettled([
      get(forecastUrl, 1800),
      gridUrl ? get(gridUrl, 1800) : Promise.reject(new Error('no grid link')),
      get(`${NWS}/stations/${AIRPORT_STATION}/observations/latest`, 600),
      get(`${NWS}/alerts/active?point=${c.lat},${c.lon}`, 300),
    ]);
    if (forecast.status !== 'fulfilled') throw forecast.reason;
    const periods = parsePeriods(forecast.value);
    if (periods.length === 0) throw new Error('Weather service returned an empty forecast');
    return {
      ok: true,
      periods,
      snow24hIn: grid.status === 'fulfilled' ? snowNext24h(grid.value, new Date()) : null,
      observation: obs.status === 'fulfilled' ? parseObservation(obs.value) : null,
      alerts: alerts.status === 'fulfilled' ? parseAlerts(alerts.value) : [],
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** Made-up storm weather to go with the sample road data at ?demo=storm. */
export const STORM_WEATHER: Weather = {
  ok: true,
  periods: [
    { name: 'Tonight', temperature: 19, unit: 'F', wind: '10 to 15 mph W', short: 'Snow', isDaytime: false },
    { name: 'Thursday', temperature: 31, unit: 'F', wind: '10 mph W', short: 'Snow showers likely', isDaytime: true },
    { name: 'Thursday Night', temperature: 15, unit: 'F', wind: '5 mph NW', short: 'Partly cloudy', isDaytime: false },
  ],
  snow24hIn: 6,
  observation: { tempF: 28, windMph: 14, windFrom: 'west', text: 'Light snow', at: new Date().toISOString() },
  alerts: [{ event: 'Winter Storm Warning', headline: 'Sample alert for preview. Not a real warning.' }],
};

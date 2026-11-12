import type { Air } from './air';
import type { RouteSummary } from './caltrans';
import { isChains } from './status';
import { sunTimes, utcOffsetHours } from './sun';
import { isFresh, type Weather } from './weather';

export type Rating = 'good' | 'fair' | 'poor' | 'info';

export interface TodayLine {
  activity: string;
  rating: Rating;
  label: string; // one or two words
  detail: string;
}

export interface Today {
  lines: TodayLine[];
  daylight: string; // e.g. "Sunrise 6:16 AM · Sunset 4:47 PM · 3 hr 10 min of daylight left"
}

const ZONE = 'America/Los_Angeles';
/** Middle of the valley, for sun times. */
const VALLEY = { lat: 34.2439, lon: -116.9114 };

const clock = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' }).format(d);

function span(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function daylightLine(now: Date): string {
  const sun = sunTimes(now, VALLEY.lat, VALLEY.lon, utcOffsetHours(now, ZONE));
  const base = `Sunrise ${clock(sun.sunrise)} · Sunset ${clock(sun.sunset)}`;
  if (now < sun.sunrise) return `${base} · Sun is up in ${span(sun.sunrise.getTime() - now.getTime())}`;
  if (now < sun.sunset) return `${base} · ${span(sun.sunset.getTime() - now.getTime())} of daylight left`;
  return `${base} · The sun is down`;
}

/** Highest number in a forecast wind string such as "5 to 15 mph". */
export function windFromText(text: string): number | null {
  const nums = (text.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : null;
}

function driveLine(routes: RouteSummary[]): TodayLine {
  const known = routes.filter((r) => r.level !== 'unknown');
  if (known.length === 0) return { activity: 'Driving up', rating: 'info', label: 'No data', detail: 'Road status is not available right now.' };
  const closed = known.filter((r) => r.level === 'closed').length;
  const chains = known.filter((r) => isChains(r.level)).length;
  if (closed > 0) {
    return { activity: 'Driving up', rating: 'poor', label: 'Closures', detail: `${closed} road${closed > 1 ? 's' : ''} closed${chains ? `, chains on ${chains} more` : ''}. Check the roads list.` };
  }
  if (chains > 0) return { activity: 'Driving up', rating: 'fair', label: 'Chains', detail: `Chain controls on ${chains} of ${routes.length} roads. Carry chains.` };
  return { activity: 'Driving up', rating: 'good', label: 'Clear', detail: 'No chain controls on any road into the valley.' };
}

/**
 * A plain summary of conditions for each activity. It describes the weather; it is not advice
 * on whether a particular trip is safe.
 */
export function buildToday(routes: RouteSummary[], weather: Weather, now: Date, air?: Air): Today {
  const lines: TodayLine[] = [driveLine(routes)];

  if (weather.ok) {
    const obs = isFresh(weather.observation, now) ? weather.observation : null;
    const first = weather.periods[0];
    const temp = obs?.tempF ?? first?.temperature ?? null;
    const wind = obs?.windMph ?? windFromText(first?.wind ?? '');
    const sky = (first?.short ?? '').toLowerCase();
    const stormy = /thunder|blizzard/.test(sky);
    const wet = /snow|rain|shower|sleet|ice|freezing/.test(sky);
    const alert = weather.alerts[0]?.event;
    const tempText = temp === null ? '' : `${temp}°F`;
    const windText = wind === null ? '' : wind < 5 ? 'calm' : `${wind} mph wind`;
    const facts = [tempText, windText, first?.short ?? ''].filter(Boolean).join(', ');

    let outdoors: TodayLine;
    if (alert) outdoors = { activity: 'Trails', rating: 'poor', label: 'Alert', detail: `${alert} in effect. ${facts}.` };
    else if (stormy || (wind !== null && wind >= 25)) outdoors = { activity: 'Trails', rating: 'poor', label: 'Rough', detail: `${facts}.` };
    else if (wet || (wind !== null && wind >= 15) || (temp !== null && (temp < 35 || temp > 88))) {
      outdoors = { activity: 'Trails', rating: 'fair', label: 'Mixed', detail: `${facts}.` };
    } else outdoors = { activity: 'Trails', rating: 'good', label: 'Nice', detail: `${facts}.` };
    lines.push(outdoors);

    if (wind !== null) {
      lines.push(
        wind >= 20
          ? { activity: 'On the lake', rating: 'poor', label: 'Rough', detail: `${wind} mph wind. Expect whitecaps.` }
          : wind >= 12
            ? { activity: 'On the lake', rating: 'fair', label: 'Choppy', detail: `${wind} mph wind.` }
            : { activity: 'On the lake', rating: 'good', label: 'Calm', detail: wind < 5 ? 'Little or no wind.' : `${wind} mph wind.` },
      );
    }

    // Snow matters from November through April.
    const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, month: 'numeric' }).format(now));
    if ((month >= 11 || month <= 4) && weather.snow24hIn !== null) {
      lines.push(
        weather.snow24hIn >= 0.1
          ? { activity: 'New snow', rating: 'info', label: `${weather.snow24hIn} in`, detail: 'Forecast for the next 24 hours.' }
          : { activity: 'New snow', rating: 'info', label: 'None', detail: 'No new snow in the next 24 hours.' },
      );
    }
  }

  const reading = air?.now ?? null;
  if (reading) {
    const rating: Rating = reading.level <= 1 ? 'good' : reading.level === 2 ? 'fair' : 'poor';
    const bits = [reading.aqi !== null ? `AQI ${reading.aqi}` : '', reading.pollutant].filter(Boolean).join(', ');
    const next = air?.tomorrow ? ` Tomorrow: ${air.tomorrow.category}.` : '';
    lines.push({ activity: 'Air quality', rating, label: shortCategory(reading.category), detail: `${bits || reading.category}.${next}` });
  }

  return { lines, daylight: daylightLine(now) };
}

/** "Unhealthy for Sensitive Groups" is too long for a tag. */
function shortCategory(category: string): string {
  return /sensitive/i.test(category) ? 'Sensitive' : category;
}

import type { Snapshot } from './caltrans';
import { getCameras, type Camera } from './cameras';
import { COMMUNITIES } from './communities';
import { getFires, SAMPLE_FIRE, type Fire } from './fires';
import { HEADLINE, LABEL, SEVERITY, parseLevel, type Level } from './status';
import { getWeather, STORM_WEATHER } from './weather';

export const LEVEL_COLOR: Record<Level, string> = {
  open: '#1F7F8C',
  r1: '#D9820F',
  r2: '#C8650A',
  r3: '#A8440C',
  closed: '#5A1220',
  unknown: '#6B7B8C',
};

/** What a pin shows: a check mark, the chain level, an X, or a question mark. */
export const LEVEL_SYMBOL: Record<Level, string> = {
  open: 'check',
  r1: 'R1',
  r2: 'R2',
  r3: 'R3',
  closed: 'x',
  unknown: '?',
};

export interface MapRoad {
  id: string;
  name: string;
  short: string;
  sub: string;
  level: Level;
  label: string;
  headline: string;
  color: string;
  symbol: string;
  at: [number, number] | null; // where the road's badge sits
}

export interface MapPoint {
  roadId: string;
  road: string;
  name: string;
  label: string;
  description: string;
  color: string;
  symbol: string;
  lon: number;
  lat: number;
  rank: number;
}

export interface MapWeather {
  slug: string;
  name: string;
  lon: number;
  lat: number;
  temp: number | null;
  period: string;
  short: string;
  snow: boolean;
}

export interface MapData {
  roads: MapRoad[];
  points: MapPoint[];
  cameras: Camera[];
  weather: MapWeather[];
  fires: Fire[];
}

export async function loadMapData(snap: Snapshot, opts: { demo: boolean; weather: boolean }): Promise<MapData> {
  const roads: MapRoad[] = [];
  const points: MapPoint[] = [];
  for (const r of snap.routes) {
    const located = r.points.filter((p) => p.lat !== null && p.lon !== null);
    // Put the badge on the middle point along the road.
    const ordered = [...located].sort((a, b) => a.lon! - b.lon! || a.lat! - b.lat!);
    const mid = ordered[Math.floor(ordered.length / 2)];
    roads.push({
      id: r.def.id,
      name: r.def.name,
      short: r.def.short,
      sub: r.def.sub,
      level: r.level,
      label: LABEL[r.level],
      headline: HEADLINE[r.level],
      color: LEVEL_COLOR[r.level],
      symbol: LEVEL_SYMBOL[r.level],
      at: mid ? [mid.lon!, mid.lat!] : null,
    });
    for (const p of located) {
      const level = parseLevel(p.status, p.description);
      points.push({
        roadId: r.def.id,
        road: r.def.name,
        name: p.locationName || p.nearbyPlace || 'Chain control point',
        label: LABEL[level],
        description: p.description,
        color: LEVEL_COLOR[level],
        symbol: LEVEL_SYMBOL[level],
        lon: p.lon!,
        lat: p.lat!,
        rank: SEVERITY[level],
      });
    }
  }

  const [cams, fireData, weather] = await Promise.all([
    getCameras(),
    opts.demo ? Promise.resolve({ ok: true, fires: [SAMPLE_FIRE] }) : getFires(),
    opts.weather
      ? Promise.all(
          COMMUNITIES.map(async (c): Promise<MapWeather> => {
            const w = opts.demo ? STORM_WEATHER : await getWeather(c);
            const first = w.periods[0];
            return {
              slug: c.slug,
              name: c.name,
              lon: c.lon,
              lat: c.lat,
              temp: first?.temperature ?? null,
              period: first?.name ?? '',
              short: first?.short ?? '',
              snow: /snow|flurr|blizzard/i.test(first?.short ?? ''),
            };
          }),
        )
      : Promise.resolve([] as MapWeather[]),
  ]);

  return {
    roads,
    points,
    cameras: cams.cameras,
    weather: weather.filter((w) => w.temp !== null),
    fires: fireData.fires,
  };
}

import { classify18 } from './routes';

// Road shapes come from OpenStreetMap. The result of the query below is stored in
// lib/road-lines.json. To refresh it, run the query at overpass-turbo.eu, export the raw data
// and pass it through buildLines.
export const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
/** South, west, north, east: the valley and every road up to it, stopping short of Apple Valley. */
const BOX = '34.0,-117.45,34.47,-116.6';

export const OVERPASS_QUERY = `[out:json][timeout:25];
relation["type"="route"]["route"="road"]["network"="US:CA"]["ref"~"^(18|38|330)$"];
out body;
way(r)(${BOX});
out geom;`;

type Line = [number, number][]; // [lon, lat]
/** Lines for each route id, plus "valley" for Hwy 18 between the dam and Big Bear City. */
export type RoadLines = Record<string, Line[]>;

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** Drop points closer than about 30 metres to the last kept one. */
function thin(line: Line): Line {
  if (line.length <= 2) return line;
  const out: Line = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    const [x, y] = out[out.length - 1];
    if (Math.abs(line[i][0] - x) + Math.abs(line[i][1] - y) > 0.0003) out.push(line[i]);
  }
  out.push(line[line.length - 1]);
  return out;
}

const KEY_FOR_18: Record<string, string | null> = {
  crestline: '18-crestline',
  front: '18-front',
  back: '18-back',
  valley: 'valley',
  other: null,
};

/** Turn an Overpass answer into lines grouped by our route ids. */
export function buildLines(json: unknown): RoadLines {
  const elements = (json as { elements?: any[] } | null)?.elements;
  const out: RoadLines = {};
  if (!Array.isArray(elements)) return out;

  const refOfWay = new Map<number, string>();
  for (const el of elements) {
    if (el?.type !== 'relation') continue;
    const ref = String(el.tags?.ref ?? '');
    for (const m of el.members ?? []) if (m?.type === 'way') refOfWay.set(m.ref, ref);
  }

  const add = (key: string | null, line: Line) => {
    if (!key || line.length < 2) return;
    (out[key] ??= []).push(thin(line).map(([x, y]) => [round(x), round(y)]));
  };

  const seen = new Set<number>();
  for (const el of elements) {
    if (el?.type !== 'way' || seen.has(el.id) || !Array.isArray(el.geometry)) continue;
    seen.add(el.id);
    const ref = refOfWay.get(el.id);
    const line: Line = el.geometry
      .filter((g: any) => typeof g?.lon === 'number' && typeof g?.lat === 'number')
      .map((g: any) => [g.lon, g.lat]);
    if (ref === '330' || ref === '38') add(ref, line);
    else if (ref === '18') {
      // Hwy 18 is one road in the data: cut it wherever it passes from one stretch to the next.
      let run: Line = [];
      let key: string | null = null;
      for (const pt of line) {
        const k = KEY_FOR_18[classify18(pt[0], pt[1])];
        if (k !== key) {
          if (run.length) add(key, [...run, pt]);
          run = [];
          key = k;
        }
        run.push(pt);
      }
      add(key, run);
    }
  }
  return out;
}

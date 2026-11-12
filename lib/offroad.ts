import { type Feature, number, queryBox, seasonOpen, seasonText, slugify, startOf, text, tidyTitle } from './arcgis';

import { getListed, type Listed, type Start, startFor } from './trailheads';

const LAKE = { lat: 34.2439, lon: -116.9114 };

const MVUM = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_02/MapServer';
export const MVUM_ROADS_URL = `${MVUM}/1`;
export const MVUM_TRAILS_URL = `${MVUM}/2`;

export interface OffRoadRoute {
  id: string;
  slug: string;
  /** The route as lines of [lon, lat], for the map. */
  paths: number[][][];
  /** Where directions go: a listed starting point when there is one, otherwise the nearest end. */
  start: Start | null;
  number: string; // forest road or trail number, e.g. "3N16"
  name: string;
  kind: 'road' | 'trail';
  miles: number | null;
  /** Who may use it, in plain words. */
  vehicles: string[];
  /** The season as published, e.g. "05/01-11/30", or "". */
  season: string;
  seasonLabel: string;
  /** True or false when the season says so; null when the Forest Service gives no dates. */
  openNow: boolean | null;
}

const isOpen = (v: unknown) => /^open/i.test(text(v));

const VEHICLES: { field: string; label: string }[] = [
  { field: 'passengervehicle', label: 'Cars' },
  { field: 'highclearancevehicle', label: 'High-clearance 4x4' },
  { field: 'fourwd_gt50inches', label: '4x4' },
  { field: 'other_ohv_gt50inches', label: 'Side-by-sides' },
  { field: 'atv', label: 'ATVs' },
  { field: 'motorcycle', label: 'Dirt bikes' },
];

/** Joins segments into whole routes. Roads open to ordinary cars only are left to the road map. */
export function buildOffRoad(
  features: Feature[],
  kind: 'road' | 'trail',
  month: number,
  day: number,
  listed: Map<string, Listed> = new Map(),
): OffRoadRoute[] {
  const byRoute = new Map<string, OffRoadRoute & { sum: number }>();
  for (const f of features) {
    const a = f.attrs;
    const no = text(a.id);
    const rawName = text(a.name);
    if (!no && !rawName) continue;
    const key = `${kind}|${no}|${rawName.toUpperCase()}`;
    let r = byRoute.get(key);
    if (!r) {
      r = { id: key, slug: slugify(`${no}-${rawName}-${kind}`), paths: [], start: null, number: no, name: tidyTitle(rawName), kind, miles: null, sum: 0, vehicles: [], season: '', seasonLabel: '', openNow: null };
      byRoute.set(key, r);
    }
    r.paths.push(...f.paths);
    r.sum += number(a.gis_miles) ?? number(a.seg_length) ?? 0;
    for (const v of VEHICLES) {
      if (isOpen(a[v.field]) && !r.vehicles.includes(v.label)) r.vehicles.push(v.label);
      if (!r.season && isOpen(a[v.field])) {
        const dates = text(a[`${v.field.replace('inches', '')}_datesopen`]);
        if (/\d/.test(dates)) r.season = dates;
      }
    }
  }
  const order = VEHICLES.map((v) => v.label);
  return [...byRoute.values()]
    .map(({ sum, ...r }) => ({
      ...r,
      start: startFor(r.number, listed, startOf(r.paths, LAKE)),
      // The motor vehicle map leaves most names blank; the recreation site list has them.
      name: r.name || tidyTitle((listed.get(r.number.toUpperCase())?.name ?? '').replace(/\b(OHV\s+)?(Road|Trail)\b.*$/i, '').trim()),
      miles: sum > 0 ? Math.round(sum * 10) / 10 : null,
      vehicles: order.filter((l) => r.vehicles.includes(l)),
      seasonLabel: seasonText(r.season),
      openNow: r.season ? seasonOpen(r.season, month, day) : null,
    }))
    .filter((r) => r.vehicles.some((v) => v !== 'Cars'))
    .sort((x, y) => (y.miles ?? 0) - (x.miles ?? 0));
}

export interface OffRoadData {
  ok: boolean;
  error?: string;
  routes: OffRoadRoute[];
  note: string;
  sample: string;
}

const ROAD_FIELDS =
  'id,name,gis_miles,seg_length,seasonal,passengervehicle,passengervehicle_datesopen,highclearancevehicle,highclearancevehicle_datesopen,fourwd_gt50inches,fourwd_gt50_datesopen,other_ohv_gt50inches,other_ohv_gt50_datesopen,atv,atv_datesopen,motorcycle,motorcycle_datesopen';

export async function getOffRoad(now = new Date()): Promise<OffRoadData> {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const listed = (await getListed()).byNumber;
  const [roads, trails] = await Promise.allSettled([
    queryBox(MVUM_ROADS_URL, { fields: ROAD_FIELDS, geometry: true }),
    queryBox(MVUM_TRAILS_URL, { fields: ROAD_FIELDS, geometry: true }),
  ]);
  const say = (label: string, r: PromiseSettledResult<Feature[]>) =>
    r.status === 'fulfilled' ? `${label}: ${r.value.length} segments` : `${label}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`;
  const note = [say('roads', roads), say('trails', trails)].join('; ');
  const routes = [
    ...(trails.status === 'fulfilled' ? buildOffRoad(trails.value, 'trail', month, day, listed) : []),
    // Short spurs clutter the list, so only longer forest roads are shown.
    ...(roads.status === 'fulfilled' ? buildOffRoad(roads.value, 'road', month, day, listed).filter((r) => (r.miles ?? 0) >= 2) : []),
  ].sort((x, y) => (y.miles ?? 0) - (x.miles ?? 0));
  const first = (roads.status === 'fulfilled' && roads.value[0]) || (trails.status === 'fulfilled' && trails.value[0]) || null;
  const ok = roads.status === 'fulfilled' || trails.status === 'fulfilled';
  return { ok, error: ok ? undefined : note, routes, note, sample: first ? JSON.stringify(first.attrs).slice(0, 500) : '' };
}

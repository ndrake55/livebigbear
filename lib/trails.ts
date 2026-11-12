import { type Feature, number, queryBox, text, tidyTitle } from './arcgis';
import { milesBetween } from './fires';

export const TRAILS_URL = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0';

const LAKE = { lat: 34.2439, lon: -116.9114 };

export type TrailUse = 'hike' | 'bike' | 'horse' | 'moto';
export const USE_LABEL: Record<TrailUse, string> = { hike: 'Hiking', bike: 'Biking', horse: 'Horses', moto: 'Motorcycles' };

export interface Trail {
  id: string;
  name: string;
  number: string;
  miles: number | null;
  uses: TrailUse[];
  /** Straight-line miles from Big Bear Lake village to the nearest part of the trail. */
  fromLake: number | null;
  surface: string;
}

const FIELDS = [
  'trail_no', 'trail_name', 'trail_type', 'gis_miles', 'segment_length', 'trail_surface',
  'hiker_pedestrian_managed', 'hiker_pedestrian_accpt_disc', 'hiker_pedestrian_restricted',
  'bicycle_managed', 'bicycle_accpt_disc', 'bicycle_restricted',
  'pack_saddle_managed', 'pack_saddle_accpt_disc', 'pack_saddle_restricted',
  'motorcycle_managed', 'motorcycle_accpt_disc', 'motorcycle_restricted',
].join(',');

const has = (v: unknown) => {
  const t = text(v).toLowerCase();
  return t !== '' && t !== 'n/a' && t !== 'na' && t !== 'none';
};

/** A use counts when the trail is managed for it or accepts it, unless it is restricted all year. */
function allows(a: Record<string, unknown>, key: string): boolean {
  if (/01\/01\s*-\s*12\/31/.test(text(a[`${key}_restricted`]))) return false;
  return has(a[`${key}_managed`]) || has(a[`${key}_accpt_disc`]);
}

/** Joins the feed's segments into whole trails, nearest to Big Bear Lake first. */
export function buildTrails(features: Feature[]): Trail[] {
  const byTrail = new Map<string, Trail & { milesSum: number }>();
  for (const f of features) {
    const a = f.attrs;
    const type = text(a.trail_type).toUpperCase();
    if (type && type !== 'TERRA') continue; // snow and water routes are separate records
    const rawName = text(a.trail_name);
    const no = text(a.trail_no);
    if (!rawName && !no) continue;
    const key = `${no}|${rawName.toUpperCase()}`;
    let t = byTrail.get(key);
    if (!t) {
      t = { id: key, name: tidyTitle(rawName || `Trail ${no}`), number: no, miles: null, milesSum: 0, uses: [], fromLake: null, surface: '' };
      byTrail.set(key, t);
    }
    t.milesSum += number(a.gis_miles) ?? number(a.segment_length) ?? 0;
    const add = (use: TrailUse, field: string) => {
      if (allows(a, field) && !t!.uses.includes(use)) t!.uses.push(use);
    };
    add('hike', 'hiker_pedestrian');
    add('bike', 'bicycle');
    add('horse', 'pack_saddle');
    add('moto', 'motorcycle');
    if (!t.surface) t.surface = text(a.trail_surface).replace(/^[A-Z]+\s*-\s*/, '').toLowerCase();
    for (const path of f.paths) {
      for (const [lon, lat] of path) {
        const d = milesBetween(LAKE, { lat, lon });
        if (t.fromLake === null || d < t.fromLake) t.fromLake = d;
      }
    }
  }
  const order: TrailUse[] = ['hike', 'bike', 'horse', 'moto'];
  return [...byTrail.values()]
    .map(({ milesSum, ...t }) => ({
      ...t,
      miles: milesSum > 0 ? Math.round(milesSum * 10) / 10 : null,
      fromLake: t.fromLake === null ? null : Math.round(t.fromLake * 10) / 10,
      uses: order.filter((u) => t.uses.includes(u)),
    }))
    .sort((x, y) => (x.fromLake ?? 999) - (y.fromLake ?? 999) || x.name.localeCompare(y.name));
}

export interface TrailData {
  ok: boolean;
  error?: string;
  trails: Trail[];
  segments: number;
  /** A raw record, for the status page. */
  sample: string;
}

export async function getTrails(): Promise<TrailData> {
  try {
    const features = await queryBox(TRAILS_URL, { fields: FIELDS, geometry: true });
    const sample = features[0] ? JSON.stringify(features[0].attrs).slice(0, 500) : '';
    return { ok: true, trails: buildTrails(features), segments: features.length, sample };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error', trails: [], segments: 0, sample: '' };
  }
}

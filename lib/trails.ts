import { type Feature, number, queryBox, slugify, startOf, text, tidyTitle } from './arcgis';
import { milesBetween } from './fires';
import { type Difficulty, knownDifficulty, knownUses } from './trail-uses';
import { getListed, type Listed, type Start, startFor } from './trailheads';

export const TRAILS_URL = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0';

const MVUM_TRAILS = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_02/MapServer/2';

const LAKE = { lat: 34.2439, lon: -116.9114 };

export type TrailUse = 'hike' | 'bike' | 'horse' | 'moto';
export const USE_LABEL: Record<TrailUse, string> = { hike: 'Hiking', bike: 'Biking', horse: 'Horses', moto: 'Motorcycles' };

export interface Trail {
  id: string;
  /** For the page address, e.g. "pine-knot-1e01". */
  slug: string;
  name: string;
  number: string;
  /** The trail as lines of [lon, lat], for the map. */
  paths: number[][][];
  /** Where directions go: a known trailhead when there is one, otherwise the nearest end of the trail. */
  start: Start | null;
  miles: number | null;
  uses: TrailUse[];
  /** True when the uses were researched or come from the data; false when only "open to hikers" is assumed. */
  usesChecked: boolean;
  /** Something to know about who may use the trail. */
  useNote: string;
  /** Published difficulty, when one has been looked up. */
  difficulty: Difficulty | null;
  /** On the Forest Service motor vehicle map, so it belongs with the off-road routes. */
  motorized: boolean;
  /** Straight-line miles from Big Bear Lake village to the nearest part of the trail. */
  fromLake: number | null;
  surface: string;
}

const FIELDS = [
  'trail_no', 'trail_name', 'trail_type', 'allowed_terra_use', 'terra_motorized', 'gis_miles', 'segment_length', 'trail_surface',
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

/**
 * Many records leave the per-use fields as "N/A" and give one summary field instead. It is
 * either a string of code digits (1 hiker, 2 pack and saddle, 3 bicycle, 4 motorcycle) or words.
 */
export function usesFromAllowed(raw: unknown): TrailUse[] {
  const t = text(raw).toLowerCase();
  if (!has(t)) return [];
  const out: TrailUse[] = [];
  const digits = /^[\d\s,;|]+$/.test(t);
  if (digits ? t.includes('1') : /hik|pedestrian|foot/.test(t)) out.push('hike');
  if (digits ? t.includes('2') : /pack|saddle|horse|equestrian/.test(t)) out.push('horse');
  if (digits ? t.includes('3') : /bicycl|bike/.test(t) && !/e-?bike/.test(t.replace(/bicycl\w*/g, ''))) out.push('bike');
  if (digits ? t.includes('4') : /motorcycle/.test(t)) out.push('moto');
  return out;
}

/** Joins the feed's segments into whole trails, nearest to Big Bear Lake first. */
export function buildTrails(
  features: Feature[],
  listed: Map<string, Listed> = new Map(),
  motorized: Set<string> = new Set(),
): Trail[] {
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
      t = { id: key, slug: slugify(`${rawName || 'trail'}-${no}`), paths: [], start: null, name: tidyTitle(rawName || `Trail ${no}`), number: no, miles: null, milesSum: 0, uses: [], usesChecked: false, useNote: '', difficulty: null, motorized: false, fromLake: null, surface: '' };
      byTrail.set(key, t);
    }
    t.milesSum += number(a.gis_miles) ?? number(a.segment_length) ?? 0;
    const add = (use: TrailUse, field: string) => {
      if (allows(a, field) && !t!.uses.includes(use)) t!.uses.push(use);
    };
    for (const u of usesFromAllowed(a.allowed_terra_use)) if (!t.uses.includes(u)) t.uses.push(u);
    add('hike', 'hiker_pedestrian');
    add('bike', 'bicycle');
    add('horse', 'pack_saddle');
    add('moto', 'motorcycle');
    if (!t.surface) t.surface = text(a.trail_surface).replace(/^[A-Z]+\s*-\s*/, '').toLowerCase();
    t.paths.push(...f.paths);
    for (const path of f.paths) {
      for (const [lon, lat] of path) {
        const d = milesBetween(LAKE, { lat, lon });
        if (t.fromLake === null || d < t.fromLake) t.fromLake = d;
      }
    }
  }
  const order: TrailUse[] = ['hike', 'bike', 'horse', 'moto'];
  return [...byTrail.values()]
    .map(({ milesSum, ...t }) => {
      // Researched uses come first, then anything the data itself says. Failing both, every
      // Forest Service trail is at least open to people on foot.
      const known = knownUses(t.number);
      const isMotor = motorized.has(t.number.toUpperCase()) || (t.uses.length > 0 && t.uses.every((u) => u === 'moto'));
      const uses: TrailUse[] = known ? known.uses : t.uses.length > 0 ? t.uses : isMotor ? [] : ['hike'];
      return { ...t, milesSum, uses, usesChecked: Boolean(known) || t.uses.length > 0, useNote: known?.note ?? '', difficulty: knownDifficulty(t.number), motorized: isMotor && !known };
    })
    .map(({ milesSum, ...t }) => ({
      ...t,
      start: startFor(t.number, listed, startOf(t.paths, LAKE)),
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
  /** The different values seen in the summary use field, for the status page. */
  allowedSeen: string;
}

export async function getTrails(): Promise<TrailData> {
  try {
    const [features, listed, motor] = await Promise.all([
      queryBox(TRAILS_URL, { fields: FIELDS, geometry: true }),
      getListed(),
      // Trails on the motor vehicle map are off-road routes, not walking trails.
      queryBox(MVUM_TRAILS, { fields: 'id' }).catch(() => []),
    ]);
    const motorized = new Set(motor.map((f) => text(f.attrs.id).toUpperCase()).filter(Boolean));
    const sample = features[0] ? JSON.stringify(features[0].attrs).slice(0, 500) : '';
    const seen = new Map<string, number>();
    for (const f of features) {
      const k = `${text(f.attrs.allowed_terra_use) || 'empty'} / motorized ${text(f.attrs.terra_motorized) || 'empty'}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const allowedSeen = [...seen].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} (${n})`).join('; ');
    return { ok: true, trails: buildTrails(features, listed.byNumber, motorized), segments: features.length, sample, allowedSeen };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error', trails: [], segments: 0, sample: '', allowedSeen: '' };
  }
}

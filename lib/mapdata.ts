import type { Snapshot } from './caltrans';
import { LABEL, SEVERITY, parseLevel, type Level } from './status';

export const LEVEL_COLOR: Record<Level, string> = {
  open: '#2A8F9C',
  r1: '#F0A93B',
  r2: '#E07B1A',
  r3: '#B8480F',
  closed: '#5A1220',
  unknown: '#8E9DAC',
};

export interface MapPoint {
  lon: number;
  lat: number;
  name: string;
  road: string;
  label: string;
  description: string;
  color: string;
  rank: number; // higher draws on top
}

/** Chain control points on the valley's roads, ready to drop on the map. */
export function mapPoints(snap: Snapshot): MapPoint[] {
  const out: MapPoint[] = [];
  for (const r of snap.routes) {
    for (const p of r.points) {
      if (p.lat === null || p.lon === null) continue;
      const level = parseLevel(p.status, p.description);
      out.push({
        lon: p.lon,
        lat: p.lat,
        name: p.locationName || p.nearbyPlace || 'Chain control point',
        road: r.def.name,
        label: LABEL[level],
        description: p.description,
        color: LEVEL_COLOR[level],
        rank: SEVERITY[level],
      });
    }
  }
  return out;
}

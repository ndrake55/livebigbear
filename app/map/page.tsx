import type { Metadata } from 'next';
import Link from 'next/link';
import { LEVEL_COLOR, mapPoints } from '@/lib/mapdata';
import { loadSnapshot, pacificTime } from '@/lib/view';
import { RoadMap } from './road-map';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Big Bear road map: live chain control on Hwy 18, 330 and 38',
  description: 'Live map of Caltrans chain control points on every road into the Big Bear Valley.',
};

const LEGEND: { color: string; text: string }[] = [
  { color: LEVEL_COLOR.open, text: 'Open' },
  { color: LEVEL_COLOR.r2, text: 'Chains' },
  { color: LEVEL_COLOR.closed, text: 'Closed' },
  { color: LEVEL_COLOR.unknown, text: 'No data' },
];

export default async function MapPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const snap = await loadSnapshot(demo);
  const points = mapPoints(snap);

  return (
    <div className="shell shell-map">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
        <div className="checked">Checked {pacificTime(snap.fetchedAt)}</div>
      </header>

      {snap.demo && <div className="notice">Sample storm data for preview. Not real conditions.</div>}
      {!snap.ok && (
        <div className="notice">Caltrans data is not responding, so the map has no road status right now.</div>
      )}

      <RoadMap points={points} />

      <div className="legend" aria-label="Map key">
        {LEGEND.map((l) => (
          <span key={l.text} className="legend-item">
            <span className="map-dot" style={{ background: l.color }} />
            {l.text}
          </span>
        ))}
      </div>
      <p className="note">
        Each dot is a Caltrans chain control point. Tap one for details. Dots mark where a stretch of road
        starts, so check the roads list for the full picture.
      </p>
    </div>
  );
}

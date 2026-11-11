import type { Metadata } from 'next';
import Link from 'next/link';
import { LEVEL_COLOR, loadMapData } from '@/lib/mapdata';
import { loadSnapshot, pacificTime } from '@/lib/view';
import { MapView } from './map-view';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Big Bear road map: live chain control, cameras and weather',
  description:
    'Live map of chain control, road cameras and weather on every road into the Big Bear Valley: Hwy 18, 330 and 38.',
};

const LEGEND: { color: string; text: string }[] = [
  { color: LEVEL_COLOR.open, text: 'Open' },
  { color: LEVEL_COLOR.r2, text: 'Chains (R1 to R3)' },
  { color: LEVEL_COLOR.closed, text: 'Closed' },
  { color: LEVEL_COLOR.unknown, text: 'No data' },
];

export default async function MapPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const snap = await loadSnapshot(demo);
  const data = await loadMapData(snap, { demo: snap.demo, weather: true });

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

      <MapView data={data} />

      <div className="legend" aria-label="Map key">
        {LEGEND.map((l) => (
          <span key={l.text} className="legend-item">
            <span className="map-dot" style={{ background: l.color }} />
            {l.text}
          </span>
        ))}
      </div>
      <p className="note">
        Tap a road, camera or temperature for details. Zoom in to see every Caltrans chain control point.
      </p>
    </div>
  );
}

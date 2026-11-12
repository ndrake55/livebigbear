import type { Metadata } from 'next';
import Link from 'next/link';
import { COMMUNITIES } from '@/lib/communities';
import { getLake, waterNote } from '@/lib/lake';
import { buildToday } from '@/lib/today';
import { getWeather } from '@/lib/weather';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Big Bear Lake level, water temperature and boat ramps today',
  description:
    'Today’s Big Bear Lake water temperature, how far the lake is below full, which public launch ramps are open, and wind on the water.',
  alternates: { canonical: '/lake' },
};

export default async function LakePage() {
  const [lake, weather] = await Promise.all([getLake(), getWeather(COMMUNITIES[0])]);
  const wind = buildToday([], weather, new Date()).lines.find((l) => l.activity === 'On the lake');

  return (
    <div className="shell">
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>The lake</h1>
        <p>Big Bear Lake today.</p>
      </div>

      {!lake.ok && <div className="notice">Lake figures are not available right now. Please try again later.</div>}

      <div className="list">
        {wind && (
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">On the water</span>
              <span className="row-sub">{wind.detail}</span>
            </span>
            <span className={`tag today-${wind.rating}`}>{wind.label}</span>
          </div>
        )}
        {lake.tempF !== null && (
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Water temperature</span>
              <span className="row-sub">{waterNote(lake.tempF)}</span>
            </span>
            <span className="temp">{lake.tempF}°F</span>
          </div>
        )}
        {lake.downFt !== null && (
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Lake level</span>
              <span className="row-sub">How far the surface is below a full lake.</span>
            </span>
            <span className="temp">{lake.downFt} ft down</span>
          </div>
        )}
        {lake.ramps.map((r) => (
          <div key={r.name} className="row row-static">
            <span className="row-text">
              <span className="row-name">{r.name === 'East ramp' ? 'East public launch ramp' : 'West public launch ramp'}</span>
              <span className="row-sub">{r.name === 'East ramp' ? 'North Shore Drive, east end' : 'North Shore Drive, near the dam'}</span>
            </span>
            <span className={`tag ${r.open ? 'today-good' : 'today-poor'}`}>{r.open ? 'Open' : 'Closed'}</span>
          </div>
        ))}
      </div>

      <p className="note">
        Lake figures are read from the Big Bear Municipal Water District, which manages the lake, and are checked
        hourly. Boats need a lake permit and a quagga mussel inspection before launching. Wind: National Weather
        Service.
      </p>
    </div>
  );
}

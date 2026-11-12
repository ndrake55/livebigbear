import type { Metadata } from 'next';
import Link from 'next/link';
import { COMMUNITIES } from '@/lib/communities';
import { directionsUrl } from '@/lib/arcgis';
import { getLake, RAMPS, waterNote } from '@/lib/lake';
import { buildToday } from '@/lib/today';
import { getWeather } from '@/lib/weather';
import { PlaceMap } from '../place-map';

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

  const status = (key: string) => lake.ramps.find((r) => r.name === key)?.open ?? null;
  const pins = RAMPS.map((r) => {
    const open = status(r.key);
    return {
      lat: r.lat,
      lon: r.lon,
      label: `${r.name}${open === null ? '' : open ? ', open' : ', closed'}`,
      text: r.key === 'East ramp' ? 'East' : 'West',
      tone: open === null ? ('start' as const) : open ? ('good' as const) : ('poor' as const),
    };
  });

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
      </div>

      <section>
        <h2>Public launch ramps</h2>
        <PlaceMap pins={pins} label="Map of Big Bear Lake with the public launch ramps" />
        <div className="list" style={{ marginTop: 12 }}>
          {RAMPS.map((r) => {
            const open = status(r.key);
            return (
              <a key={r.key} href={directionsUrl(r.address)} target="_blank" rel="noopener noreferrer" className="row">
                <span className="row-text">
                  <span className="row-name">{r.name}</span>
                  <span className="row-sub">
                    {r.full} · {r.where}
                  </span>
                  <span className="row-sub">{r.address.replace(', CA', '')} · Tap for directions</span>
                </span>
                {open !== null && <span className={`tag ${open ? 'today-good' : 'today-poor'}`}>{open ? 'Open' : 'Closed'}</span>}
              </a>
            );
          })}
        </div>
      </section>

      <p className="note">
        Lake figures are read from the Big Bear Municipal Water District, which manages the lake, and are checked
        hourly. Ramp positions on the map are approximate; directions use the street address. Boats need a lake permit and a quagga mussel inspection before launching. Wind: National Weather
        Service.
      </p>
    </div>
  );
}

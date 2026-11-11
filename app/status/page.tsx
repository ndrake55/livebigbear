import type { Metadata } from 'next';
import Link from 'next/link';
import { CC_URL, getSnapshot } from '@/lib/caltrans';
import { ROUTES } from '@/lib/routes';
import { hasDb } from '@/lib/db';
import { COMMUNITIES } from '@/lib/communities';
import { getWeather, isFresh } from '@/lib/weather';
import { getCameras } from '@/lib/cameras';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Data check', robots: { index: false } };

/** Plain diagnostic page: is the Caltrans feed answering, and which points land on which route? */
export default async function StatusPage() {
  const [snap, weather, cams] = await Promise.all([getSnapshot(), getWeather(COMMUNITIES[0]), getCameras()]);
  const caltransCams = cams.cameras.filter((c) => c.credit === 'Caltrans');
  const obsFresh = isFresh(weather.observation, new Date());
  const valley = snap.points.filter((p) => ['18', '330', '38'].includes(p.route));
  const routeFor = (p: (typeof valley)[number]) => ROUTES.find((r) => r.match(p))?.name ?? 'not assigned';

  return (
    <div className="shell" style={{ maxWidth: 900 }}>
      <Link href="/" className="back">
        <span aria-hidden="true">‹</span> Home
      </Link>
      <div className="title">
        <h1>Data check</h1>
        <p>For setting up the app. Not linked from the public pages.</p>
      </div>
      <div className="list">
        <div className="row">
          <span className="row-text">
            <span className="row-name">Caltrans chain control feed</span>
            <span className="row-sub">{snap.ok ? CC_URL : `${snap.error} (${CC_URL})`}</span>
          </span>
          <span className={`tag ${snap.ok ? 'tag-open' : 'tag-closed'}`}>{snap.ok ? 'Working' : 'Failing'}</span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Points in feed</span>
            <span className="row-sub">
              {snap.points.length} in District 8, {valley.length} on Hwy 18, 330 or 38
            </span>
          </span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Weather service forecast</span>
            <span className="row-sub">
              {weather.ok
                ? `${weather.periods.length} forecast periods, ${weather.alerts.length} active alerts, snow next 24 hr: ${weather.snow24hIn ?? 'no data'}`
                : weather.error}
            </span>
          </span>
          <span className={`tag ${weather.ok ? 'tag-open' : 'tag-closed'}`}>{weather.ok ? 'Working' : 'Failing'}</span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Airport weather station</span>
            <span className="row-sub">
              {weather.observation
                ? `${weather.observation.tempF ?? '?'}°F, wind ${weather.observation.windMph ?? '?'} mph, read at ${weather.observation.at}`
                : 'No reading returned'}
            </span>
          </span>
          <span className={`tag ${obsFresh ? 'tag-open' : 'tag-unknown'}`}>{obsFresh ? 'Fresh' : 'Stale or missing'}</span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Caltrans camera feed</span>
            <span className="row-sub">
              {cams.ok ? `${caltransCams.length} cameras on Hwy 18, 330 or 38` : cams.error}
            </span>
          </span>
          <span className={`tag ${cams.ok && caltransCams.length > 0 ? 'tag-open' : 'tag-closed'}`}>
            {cams.ok ? (caltransCams.length > 0 ? 'Working' : 'No cameras found') : 'Failing'}
          </span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Road shapes for map lines</span>
            <span className="row-sub">
              Open <a href="/api/road-lines">/api/road-lines</a>. A long list of numbers means it works; an
              error message means the lines will not draw.
            </span>
          </span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Database</span>
            <span className="row-sub">{hasDb() ? 'Connection setting found' : 'No DATABASE_URL setting'}</span>
          </span>
          <span className={`tag ${hasDb() ? 'tag-open' : 'tag-unknown'}`}>{hasDb() ? 'Set' : 'Missing'}</span>
        </div>
      </div>
      {valley.length > 0 && (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Hwy</th>
                <th>Location</th>
                <th>Lat, lon</th>
                <th>Status</th>
                <th>Counted as</th>
              </tr>
            </thead>
            <tbody>
              {valley.map((p, i) => (
                <tr key={i}>
                  <td>{p.route}</td>
                  <td>
                    {p.locationName}
                    {p.nearbyPlace ? ` (${p.nearbyPlace})` : ''}
                  </td>
                  <td>
                    {p.lat ?? '?'}, {p.lon ?? '?'}
                  </td>
                  <td>{p.status || 'none'}</td>
                  <td>{routeFor(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

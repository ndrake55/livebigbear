import type { Metadata } from 'next';
import Link from 'next/link';
import { CC_URL, getSnapshot } from '@/lib/caltrans';
import { ROUTES } from '@/lib/routes';
import { hasDb } from '@/lib/db';
import { COMMUNITIES } from '@/lib/communities';
import { getWeather, isFresh } from '@/lib/weather';
import { getCameras } from '@/lib/cameras';
import { FIRE_RADIUS_MILES, getFires } from '@/lib/fires';
import { runProbes } from '@/lib/probes';
import { getTrails } from '@/lib/trails';
import { getOffRoad } from '@/lib/offroad';
import { getLake } from '@/lib/lake';
import { getListed } from '@/lib/trailheads';
import { getAir } from '@/lib/air';
import { getCampgrounds } from '@/lib/camping';
import { isMailConfigured } from '@/lib/mailer';
import { ensureEmailTables, subscriberCounts } from '@/lib/subscribers';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Data check', robots: { index: false } };

/** Plain diagnostic page: is the Caltrans feed answering, and which points land on which route? */
export default async function StatusPage() {
  const [snap, weather, cams, fireData, probes, air, camps, trails, offroad, lake, listed] = await Promise.all([
    getSnapshot(),
    getWeather(COMMUNITIES[0]),
    getCameras(),
    getFires(),
    runProbes(),
    getAir(),
    getCampgrounds(),
    getTrails(),
    getOffRoad(),
    getLake(),
    getListed(),
  ]);
  const caltransCams = cams.cameras.filter((c) => c.credit === 'Caltrans');
  let subs: Record<string, number> | null = null;
  let subsError = '';
  if (hasDb()) {
    try {
      await ensureEmailTables();
      subs = await subscriberCounts();
    } catch (e) {
      subsError = e instanceof Error ? e.message : 'database error';
    }
  }
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
              {cams.ok
                ? `${caltransCams.length} cameras on Hwy 18, 330 or 38. Feed has ${cams.tally?.inFeed ?? '?'}; ${cams.tally?.inArea ?? '?'} in the area on roads ${cams.tally?.roadsInArea || 'none'}; ${cams.tally?.onOurRoads ?? '?'} on our roads; ${cams.tally?.inService ?? '?'} in service; ${cams.tally?.withImage ?? '?'} with an image.`
                : cams.error}
            </span>
          </span>
          <span className={`tag ${cams.ok && caltransCams.length > 0 ? 'tag-open' : 'tag-closed'}`}>
            {cams.ok ? (caltransCams.length > 0 ? 'Working' : 'No cameras found') : 'Failing'}
          </span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">CAL FIRE incident feed</span>
            <span className="row-sub">
              {fireData.ok
                ? `${fireData.fires.length} active within ${FIRE_RADIUS_MILES} miles${fireData.fires.length ? `: ${fireData.fires.map((f) => f.name).join(', ')}` : ''}`
                : fireData.error}
            </span>
          </span>
          <span className={`tag ${fireData.ok ? 'tag-open' : 'tag-closed'}`}>{fireData.ok ? 'Working' : 'Failing'}</span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Air quality (AirNow)</span>
            <span className="row-sub">
              {!air.configured
                ? 'Needs AIRNOW_API_KEY.'
                : air.ok
                  ? `Now: ${air.now ? `${air.now.category}${air.now.aqi !== null ? `, AQI ${air.now.aqi}` : ''}${air.nowIsForecast ? ' (from today\'s forecast, no measured reading)' : ''}` : 'no reading'}. Tomorrow: ${air.tomorrow?.category ?? 'no forecast'}. Requests: ${air.note}`
                  : air.error}
            </span>
          </span>
          <span className={`tag ${air.ok ? 'tag-open' : air.configured ? 'tag-closed' : 'tag-unknown'}`}>
            {air.ok ? 'Working' : air.configured ? 'Failing' : 'Not set up'}
          </span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Campgrounds (Recreation.gov)</span>
            <span className="row-sub">
              {!camps.configured
                ? 'Needs RIDB_API_KEY.'
                : camps.ok
                  ? `${camps.campgrounds.length} within 20 miles, ${camps.campgrounds.filter((c) => c.tonight).length} with a forecast: ${camps.campgrounds.slice(0, 6).map((c) => c.name).join(', ')}`
                  : camps.error}
            </span>
          </span>
          <span className={`tag ${camps.ok && camps.campgrounds.length > 0 ? 'tag-open' : camps.configured ? 'tag-closed' : 'tag-unknown'}`}>
            {camps.ok ? (camps.campgrounds.length > 0 ? 'Working' : 'None found') : camps.configured ? 'Failing' : 'Not set up'}
          </span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Trails (Forest Service)</span>
            <span className="row-sub">{trails.ok ? `${trails.trails.length} trails from ${trails.segments} segments. With a use listed: ${trails.trails.filter((t) => t.uses.length > 0).length}. First: ${trails.trails.slice(0, 5).map((t) => `${t.name} (${t.miles ?? '?'} mi, ${t.uses.join('/') || 'no use listed'})`).join('; ')}. Allowed-use values: ${trails.allowedSeen}. Raw record: ${trails.sample.slice(0, 160)}` : trails.error}</span>
          </span>
          <span className={`tag ${trails.ok ? 'tag-open' : 'tag-closed'}`}>{trails.ok ? 'Working' : 'Problem'}</span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Off-road routes (Forest Service)</span>
            <span className="row-sub">{`${offroad.routes.length} routes. ${offroad.note}. First: ${offroad.routes.slice(0, 5).map((r) => `${r.number} ${r.name} (${r.miles ?? '?'} mi, ${r.season || 'no season'})`).join('; ')}. Raw record: ${offroad.sample}`}</span>
          </span>
          <span className={`tag ${offroad.ok ? 'tag-open' : 'tag-closed'}`}>{offroad.ok ? 'Working' : 'Problem'}</span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Lake figures (water district)</span>
            <span className="row-sub">{lake.ok ? `Water ${lake.tempF ?? '?'}°F, ${lake.downFt ?? '?'} ft down, ${lake.ramps.map((r) => `${r.name} ${r.open ? 'open' : 'closed'}`).join(', ') || 'no ramps found'}` : lake.error}</span>
          </span>
          <span className={`tag ${lake.ok ? 'tag-open' : 'tag-closed'}`}>{lake.ok ? 'Working' : 'Problem'}</span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Trailheads</span>
            <span className="row-sub">
              {`Trails with a checked trailhead: ${trails.trails.filter((t) => t.start?.kind === 'checked').length}; from the Forest Service site list: ${trails.trails.filter((t) => t.start?.kind === 'listed').length}; best guess: ${trails.trails.filter((t) => t.start?.kind === 'guess').length}. Best-guess trails: ${trails.trails.filter((t) => t.start?.kind === 'guess').map((t) => `${t.name} ${t.number}`).join('; ')}. Site list: ${listed.note}`}
            </span>
          </span>
          <span className={`tag ${listed.ok ? 'tag-open' : 'tag-unknown'}`}>{listed.ok ? 'Working' : 'List not read'}</span>
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
            <span className="row-name">Email sending (Amazon SES)</span>
            <span className="row-sub">
              {isMailConfigured()
                ? 'All four settings found. Signup is switched on.'
                : 'Needs SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY, SES_REGION and EMAIL_FROM. Signup stays hidden until then.'}
            </span>
          </span>
          <span className={`tag ${isMailConfigured() ? 'tag-open' : 'tag-unknown'}`}>
            {isMailConfigured() ? 'Set' : 'Not set up'}
          </span>
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Email subscribers</span>
            <span className="row-sub">
              {subs
                ? `${subs.confirmed ?? 0} confirmed, ${subs.pending ?? 0} waiting to confirm, ${subs.unsubscribed ?? 0} unsubscribed, ${subs.suppressed ?? 0} blocked`
                : subsError || 'No database'}
            </span>
          </span>
          {subsError && <span className="tag tag-closed">Failing</span>}
        </div>
        <div className="row">
          <span className="row-text">
            <span className="row-name">Database</span>
            <span className="row-sub">{hasDb() ? 'Connection setting found' : 'No DATABASE_URL setting'}</span>
          </span>
          <span className={`tag ${hasDb() ? 'tag-open' : 'tag-unknown'}`}>{hasDb() ? 'Set' : 'Missing'}</span>
        </div>
      </div>
      <section>
        <h2>Sources being tested for upcoming features</h2>
        <div className="list">
          {probes.map((p) => (
            <div key={p.name} className="row">
              <span className="row-text">
                <span className="row-name">{p.name}</span>
                <span className="row-sub">{p.summary}</span>
                <span className="row-sub" style={{ wordBreak: 'break-word' }}>
                  {p.detail}
                </span>
              </span>
              <span className={`tag ${p.ok ? 'tag-open' : 'tag-closed'}`}>{p.ok ? 'Working' : 'Failing'}</span>
            </div>
          ))}
        </div>
      </section>

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

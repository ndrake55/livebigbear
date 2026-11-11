import type { Metadata } from 'next';
import Link from 'next/link';
import { CC_URL, getSnapshot } from '@/lib/caltrans';
import { ROUTES } from '@/lib/routes';
import { hasDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Data check', robots: { index: false } };

/** Plain diagnostic page: is the Caltrans feed answering, and which points land on which route? */
export default async function StatusPage() {
  const snap = await getSnapshot();
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

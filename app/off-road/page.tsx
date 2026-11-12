import type { Metadata } from 'next';
import Link from 'next/link';
import { getOffRoad } from '@/lib/offroad';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Big Bear off-road trails: 4x4 and dirt bike routes open now',
  description:
    'Forest Service off-road routes around Big Bear for 4x4s, side-by-sides, ATVs and dirt bikes, with each route’s open season.',
  alternates: { canonical: '/off-road' },
};

export default async function OffRoadPage() {
  const data = await getOffRoad();

  return (
    <div className="shell">
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>Off-road routes</h1>
        <p>Forest roads and trails around the valley that are open to 4x4s, ATVs or dirt bikes, longest first.</p>
      </div>

      {!data.ok && <div className="notice">The off-road list is not available right now. Please try again later.</div>}
      {data.ok && data.routes.length === 0 && <div className="notice">No off-road routes were found.</div>}

      {data.routes.length > 0 && (
        <div className="list">
          {data.routes.map((r) => (
            <Link key={r.id} href={`/off-road/${r.slug}`} className="row">
              <span className="row-text">
                <span className="row-name">{[r.number, r.name].filter(Boolean).join(' ')}</span>
                <span className="row-sub">
                  {[r.miles !== null ? `${r.miles} mi` : '', r.vehicles.join(', ')].filter(Boolean).join(' · ')}
                </span>
                {r.seasonLabel && <span className="row-sub">Season: {r.seasonLabel}</span>}
              </span>
              {r.openNow !== null && (
                <span className={`tag ${r.openNow ? 'today-good' : 'today-poor'}`}>{r.openNow ? 'In season' : 'Out of season'}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      <p className="note">
        Seasons come from the Forest Service motor vehicle use map. A route that is in season can still be closed
        by snow, mud, fire or a forest order, so check with the Big Bear Discovery Center before you go. Vehicles
        need to be street legal or carry a California green or red sticker. Route data: US Forest Service.
      </p>
    </div>
  );
}

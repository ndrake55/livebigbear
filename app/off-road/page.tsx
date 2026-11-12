import type { Metadata } from 'next';
import Link from 'next/link';
import { getOffRoad } from '@/lib/offroad';
import { popularity, ratingsFor, ratingText } from '@/lib/ratings';

const SORTS = [
  { key: 'popular', label: 'Most popular' },
  { key: 'long', label: 'Longest' },
  { key: 'az', label: 'A to Z' },
] as const;

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Big Bear off-road trails: 4x4 and dirt bike routes open now',
  description:
    'Forest Service off-road routes around Big Bear for 4x4s, side-by-sides, ATVs and dirt bikes, with each route’s open season.',
  alternates: { canonical: '/off-road' },
};

export default async function OffRoadPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const asked = (await searchParams).sort;
  const sort = SORTS.find((x) => x.key === asked)?.key ?? 'popular';
  const [data, ratings] = await Promise.all([getOffRoad(), ratingsFor('offroad')]);
  const title = (r: (typeof data.routes)[number]) => [r.number, r.name].filter(Boolean).join(' ');
  // The list arrives longest first, which also settles ties.
  const routes = [...data.routes];
  if (sort === 'popular') {
    const score = (r: (typeof routes)[number]) => popularity('offroad', r.number, ratings.get(`offroad:${r.slug}`));
    routes.sort((a, b) => score(b) - score(a));
  }
  if (sort === 'az') routes.sort((a, b) => title(a).localeCompare(title(b)));

  return (
    <div className="shell">
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>Off-road routes</h1>
        <p>Forest roads and trails around the valley that are open to 4x4s, ATVs or dirt bikes.</p>
      </div>

      {!data.ok && <div className="notice">The off-road list is not available right now. Please try again later.</div>}
      {data.ok && data.routes.length === 0 && <div className="notice">No off-road routes were found.</div>}

      <nav className="chips" aria-label="Sort order">
        <span className="chips-label">Sort</span>
        {SORTS.map((x) => (
          <Link
            key={x.key}
            href={x.key === 'popular' ? '/off-road' : `/off-road?sort=${x.key}`}
            className={`chip${sort === x.key ? ' chip-on' : ''}`}
            aria-current={sort === x.key ? 'page' : undefined}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {routes.length > 0 && (
        <div className="list">
          {routes.map((r, i) => (
            <Link key={r.id} href={`/off-road/${r.slug}`} className="row">
              {sort === 'popular' && <span className="rank">{i + 1}</span>}
              <span className="row-text">
                <span className="row-name">{title(r)}</span>
                <span className="row-sub">
                  {[r.miles !== null ? `${r.miles} mi` : '', r.vehicles.join(', ')].filter(Boolean).join(' · ')}
                </span>
                {r.seasonLabel && <span className="row-sub">Season: {r.seasonLabel}</span>}
                {ratings.get(`offroad:${r.slug}`) && <span className="row-sub">★ {ratingText(ratings.get(`offroad:${r.slug}`)!)}</span>}
              </span>
              {r.openNow !== null && (
                <span className={`tag ${r.openNow ? 'today-good' : 'today-poor'}`}>{r.openNow ? 'In season' : 'Out of season'}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      <p className="note">
        Most popular starts from our own ranking of the best-known routes and shifts as visitors rate them. Open a
        route to add your rating.
      </p>
      <p className="note">
        Seasons come from the Forest Service motor vehicle use map. A route that is in season can still be closed
        by snow, mud, fire or a forest order, so check with the Big Bear Discovery Center before you go. Vehicles
        need to be street legal or carry a California green or red sticker. Route data: US Forest Service.
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getCampgrounds } from '@/lib/camping';
import { popularity, ratingsFor, ratingText } from '@/lib/ratings';

const SORTS = [
  { key: 'near', label: 'Nearest' },
  { key: 'popular', label: 'Top rated' },
  { key: 'az', label: 'A to Z' },
] as const;

export const revalidate = 1800;

export const metadata: Metadata = {
  alternates: { canonical: '/camping' },
  title: 'Big Bear campgrounds: tonight’s low at each one',
  description:
    'Campgrounds within 20 miles of Big Bear Lake, with tonight’s forecast low at each and a link to check dates.',
};

export default async function CampingPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const asked = (await searchParams).sort;
  const sort = SORTS.find((x) => x.key === asked)?.key ?? 'near';
  const [data, ratings] = await Promise.all([getCampgrounds(), ratingsFor('camp')]);
  // The list arrives nearest first, which also settles ties.
  const camps = [...data.campgrounds];
  if (sort === 'popular') {
    const score = (c: (typeof camps)[number]) => popularity('camp', c.id, ratings.get(`camp:${c.slug}`));
    camps.sort((a, b) => score(b) - score(a));
  }
  if (sort === 'az') camps.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="shell">
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>Camping</h1>
        <p>Campgrounds within 20 miles of Big Bear Lake, with tonight’s forecast at each one.</p>
      </div>

      {!data.configured && <div className="notice">The campground list is not switched on yet.</div>}
      {data.configured && !data.ok && (
        <div className="notice">The campground list is not available right now. Please try again later.</div>
      )}
      {data.ok && data.campgrounds.length === 0 && <div className="notice">No campgrounds were found nearby.</div>}

      {camps.length > 0 && (
        <>
          <nav className="chips" aria-label="Sort order">
            <span className="chips-label">Sort</span>
            {SORTS.map((x) => (
              <Link
                key={x.key}
                href={x.key === 'near' ? '/camping' : `/camping?sort=${x.key}`}
                className={`chip${sort === x.key ? ' chip-on' : ''}`}
                aria-current={sort === x.key ? 'page' : undefined}
              >
                {x.label}
              </Link>
            ))}
          </nav>
          <div className="list">
            {camps.map((c) => {
              const rating = ratings.get(`camp:${c.slug}`);
              return (
                <Link key={c.id} href={`/camping/${c.slug}`} className="row">
                  <span className="row-text">
                    <span className="row-name">{c.name}</span>
                    <span className="row-sub">
                      {c.miles} mi from Big Bear Lake · {c.reservable ? 'Takes reservations' : 'Check how to book'}
                    </span>
                    {c.tonight && (
                      <span className="row-sub">
                        {c.tonight.name}: {c.tonight.short}
                      </span>
                    )}
                    {rating && <span className="row-sub">★ {ratingText(rating)}</span>}
                  </span>
                  {c.tonight && <span className="temp">Low {c.tonight.low}°</span>}
                </Link>
              );
            })}
          </div>
        </>
      )}

      <p className="note">
        Tap a campground for a map, directions and visitor ratings. This list does not show whether a
        campground is open for the season. Campground data: Recreation.gov. Forecasts: National Weather Service.
      </p>
    </div>
  );
}

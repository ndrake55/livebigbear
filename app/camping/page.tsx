import type { Metadata } from 'next';
import Link from 'next/link';
import { getCampgrounds } from '@/lib/camping';

export const revalidate = 1800;

export const metadata: Metadata = {
  alternates: { canonical: '/camping' },
  title: 'Big Bear campgrounds: tonight’s low at each one',
  description:
    'Campgrounds within 20 miles of Big Bear Lake, with tonight’s forecast low at each and a link to check dates.',
};

export default async function CampingPage() {
  const data = await getCampgrounds();

  return (
    <div className="shell">
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>Camping</h1>
        <p>Campgrounds within 20 miles of Big Bear Lake, nearest first, with tonight’s forecast at each one.</p>
      </div>

      {!data.configured && <div className="notice">The campground list is not switched on yet.</div>}
      {data.configured && !data.ok && (
        <div className="notice">The campground list is not available right now. Please try again later.</div>
      )}
      {data.ok && data.campgrounds.length === 0 && <div className="notice">No campgrounds were found nearby.</div>}

      {data.campgrounds.length > 0 && (
        <div className="list">
          {data.campgrounds.map((c) => (
            <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" className="row">
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
              </span>
              {c.tonight && <span className="temp">Low {c.tonight.low}°</span>}
            </a>
          ))}
        </div>
      )}

      <p className="note">
        Tap a campground to check dates and current notices on Recreation.gov. This list does not show whether a
        campground is open for the season. Campground data: Recreation.gov. Forecasts: National Weather Service.
      </p>
    </div>
  );
}

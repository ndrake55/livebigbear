import type { Metadata } from 'next';
import Link from 'next/link';
import { COMMUNITIES } from '@/lib/communities';
import { buildToday } from '@/lib/today';
import { getTrails, USE_LABEL, type TrailUse } from '@/lib/trails';
import { getWeather } from '@/lib/weather';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Big Bear hiking and mountain bike trails, with today’s conditions',
  description:
    'Forest Service trails around Big Bear Lake for hiking, mountain biking and horses: length, distance from town and today’s trail weather.',
  alternates: { canonical: '/trails' },
};

/** The list starts with trails this close to Big Bear Lake village. */
const NEAR_MILES = 10;

const FILTERS: { key: TrailUse; label: string }[] = [
  { key: 'hike', label: 'Hiking' },
  { key: 'bike', label: 'Biking' },
  { key: 'horse', label: 'Horses' },
];

export default async function TrailsPage({ searchParams }: { searchParams: Promise<{ for?: string; all?: string }> }) {
  const params = await searchParams;
  const asked = params.for;
  const all = params.all === '1';
  const want = FILTERS.find((f) => f.key === asked)?.key;
  const [data, weather] = await Promise.all([getTrails(), getWeather(COMMUNITIES[0])]);
  const outlook = buildToday([], weather, new Date()).lines.find((l) => l.activity === 'Trails');
  // Motorcycle-only routes belong on the off-road page.
  const walkable = data.trails.filter((t) => !t.motorized && t.uses.some((u) => u !== 'moto'));
  const matching = want ? walkable.filter((t) => t.uses.includes(want)) : walkable;
  const near = matching.filter((t) => t.fromLake !== null && t.fromLake <= NEAR_MILES);
  const shown = all ? matching : near;
  const hidden = matching.length - near.length;
  const link = (use?: string, everything = all) => {
    const q = new URLSearchParams();
    if (use) q.set('for', use);
    if (everything) q.set('all', '1');
    const qs = q.toString();
    return qs ? `/trails?${qs}` : '/trails';
  };

  return (
    <div className="shell">
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>Trails</h1>
        <p>
          {all
            ? 'Every Forest Service trail in the area, nearest to Big Bear Lake first.'
            : `Forest Service trails within ${NEAR_MILES} miles of Big Bear Lake, nearest first.`}
        </p>
      </div>

      {outlook && (
        <div className="list">
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">On the trails today</span>
              <span className="row-sub">{outlook.detail}</span>
            </span>
            <span className={`tag today-${outlook.rating}`}>{outlook.label}</span>
          </div>
        </div>
      )}

      <nav className="chips" aria-label="Trail use">
        <Link href={link()} className={`chip${want ? '' : ' chip-on'}`} aria-current={want ? undefined : 'page'}>
          All
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={link(f.key)}
            className={`chip${want === f.key ? ' chip-on' : ''}`}
            aria-current={want === f.key ? 'page' : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {!data.ok && <div className="notice">The trail list is not available right now. Please try again later.</div>}
      {data.ok && shown.length === 0 && (
        <div className="notice">{hidden > 0 && !all ? `No trails for this use within ${NEAR_MILES} miles.` : 'No trails are listed for this use.'}</div>
      )}

      {shown.length > 0 && (
        <div className="list">
          {shown.map((t) => (
            <Link key={t.id} href={`/trails/${t.slug}`} className="row">
              <span className="row-text">
                <span className="row-name">{t.name}</span>
                <span className="row-sub">
                  {[
                    t.uses.filter((u) => u !== 'moto').map((u) => USE_LABEL[u]).join(', '),
                    t.fromLake !== null ? `${t.fromLake} mi from Big Bear Lake` : '',
                    t.number ? `Trail ${t.number}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {t.miles !== null && <span className="temp">{t.miles} mi</span>}
            </Link>
          ))}
        </div>
      )}

      {data.ok && !all && hidden > 0 && (
        <Link className="btn btn-quiet" href={link(want, true)}>
          Show {hidden} more trail{hidden === 1 ? '' : 's'} farther out
        </Link>
      )}
      {data.ok && all && hidden > 0 && (
        <Link className="btn btn-quiet" href={link(want, false)}>
          Show only trails within {NEAR_MILES} miles
        </Link>
      )}

      <p className="note">
Hiking, biking and horse labels were checked by hand for the trails nearest the lake. A trail marked
        only for hiking may also allow bikes or horses, so read the signs at the trailhead. Lengths cover the whole trail, which can run beyond the valley. Distance is a straight line from Big Bear
        Lake village to the nearest part of the trail. This list does not show snow, downed trees or closures, so
        check with the Big Bear Discovery Center before a long outing. Trail data: US Forest Service.
      </p>
      <p className="note">
        Looking for 4x4 and dirt bike routes? See <Link href="/off-road">off-road routes</Link>.
      </p>
    </div>
  );
}

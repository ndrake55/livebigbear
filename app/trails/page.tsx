import type { Metadata } from 'next';
import Link from 'next/link';
import { COMMUNITIES } from '@/lib/communities';
import { buildToday } from '@/lib/today';
import { popularity, ratingsFor, ratingText } from '@/lib/ratings';
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

const LEVELS = [
  { key: 'easy', label: 'Easy' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'hard', label: 'Hard' },
] as const;

const SORTS = [
  { key: 'popular', label: 'Most popular' },
  { key: 'near', label: 'Nearest' },
  { key: 'az', label: 'A to Z' },
] as const;

const FILTERS: { key: TrailUse; label: string }[] = [
  { key: 'hike', label: 'Hiking' },
  { key: 'bike', label: 'Biking' },
  { key: 'horse', label: 'Horses' },
];

export default async function TrailsPage({ searchParams }: { searchParams: Promise<{ for?: string; all?: string; sort?: string; level?: string }> }) {
  const params = await searchParams;
  const asked = params.for;
  const all = params.all === '1';
  const want = FILTERS.find((f) => f.key === asked)?.key;
  const sort = SORTS.find((x) => x.key === params.sort)?.key ?? 'popular';
  const [data, weather, ratings] = await Promise.all([getTrails(), getWeather(COMMUNITIES[0]), ratingsFor('trail')]);
  const outlook = buildToday([], weather, new Date()).lines.find((l) => l.activity === 'Trails');
  // Motorcycle-only routes belong on the off-road page.
  const walkable = data.trails.filter((t) => !t.motorized && t.uses.some((u) => u !== 'moto'));
  const level = LEVELS.find((x) => x.key === params.level)?.key;
  const byUse = want ? walkable.filter((t) => t.uses.includes(want)) : walkable;
  const matching = level ? byUse.filter((t) => t.difficulty?.level === level) : byUse;
  const near = matching.filter((t) => t.fromLake !== null && t.fromLake <= NEAR_MILES);
  const score = (t: (typeof matching)[number]) => popularity('trail', t.number, ratings.get(`trail:${t.slug}`));
  // The list arrives nearest first, which also settles ties.
  const shown = [...(all ? matching : near)];
  if (sort === 'popular') shown.sort((a, b) => score(b) - score(a));
  if (sort === 'az') shown.sort((a, b) => a.name.localeCompare(b.name));
  const hidden = matching.length - near.length;
  const link = (use?: string, everything = all, order: string = sort, lvl: string | undefined = level) => {
    const q = new URLSearchParams();
    if (use) q.set('for', use);
    if (everything) q.set('all', '1');
    if (order !== 'popular') q.set('sort', order);
    if (lvl) q.set('level', lvl);
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
          {all ? 'Every Forest Service trail in the area.' : `Forest Service trails within ${NEAR_MILES} miles of Big Bear Lake.`}
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

      <nav className="chips" aria-label="Difficulty">
        <span className="chips-label">Difficulty</span>
        <Link href={link(want, all, sort, '')} className={`chip${level ? '' : ' chip-on'}`} aria-current={level ? undefined : 'page'}>
          Any
        </Link>
        {LEVELS.map((x) => (
          <Link
            key={x.key}
            href={link(want, all, sort, x.key)}
            className={`chip${level === x.key ? ' chip-on' : ''}`}
            aria-current={level === x.key ? 'page' : undefined}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      <nav className="chips" aria-label="Sort order">
        <span className="chips-label">Sort</span>
        {SORTS.map((x) => (
          <Link
            key={x.key}
            href={link(want, all, x.key)}
            className={`chip${sort === x.key ? ' chip-on' : ''}`}
            aria-current={sort === x.key ? 'page' : undefined}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {!data.ok && <div className="notice">The trail list is not available right now. Please try again later.</div>}
      {data.ok && shown.length === 0 && (
        <div className="notice">{hidden > 0 && !all ? `No trails match these choices within ${NEAR_MILES} miles.` : 'No trails match these choices.'}</div>
      )}

      {shown.length > 0 && (
        <div className="list">
          {shown.map((t, i) => {
            const rating = ratings.get(`trail:${t.slug}`);
            return (
            <Link key={t.id} href={`/trails/${t.slug}`} className="row">
              {sort === 'popular' && <span className="rank">{i + 1}</span>}
              <span className="row-text">
                <span className="row-name">{t.name}</span>
                <span className="row-sub">
                  {[
                    t.difficulty?.label ?? '',
                    t.uses.filter((u) => u !== 'moto').map((u) => USE_LABEL[u]).join(', '),
                    t.fromLake !== null ? `${t.fromLake} mi from Big Bear Lake` : '',
                    t.number ? `Trail ${t.number}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {rating && <span className="row-sub">★ {ratingText(rating)}</span>}
              </span>
              {t.miles !== null && <span className="temp">{t.miles} mi</span>}
            </Link>
            );
          })}
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
        Most popular starts from our own ranking of the best-known trails and shifts as visitors rate them. Open
        a trail to add your rating.
      </p>
      <p className="note">
        Difficulty is the rating published by the Forest Service, or by the Big Bear visitor bureau where the
        Forest Service gives none. Trails without a published rating show no difficulty and are left out when you
        pick one.
      </p>
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

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

const FILTERS: { key: TrailUse; label: string }[] = [
  { key: 'hike', label: 'Hiking' },
  { key: 'bike', label: 'Biking' },
  { key: 'horse', label: 'Horses' },
];

export default async function TrailsPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const asked = (await searchParams).for;
  const want = FILTERS.find((f) => f.key === asked)?.key;
  const [data, weather] = await Promise.all([getTrails(), getWeather(COMMUNITIES[0])]);
  const outlook = buildToday([], weather, new Date()).lines.find((l) => l.activity === 'Trails');
  // Motorcycle-only routes belong on the off-road page.
  const walkable = data.trails.filter((t) => t.uses.length === 0 || t.uses.some((u) => u !== 'moto'));
  const shown = want ? walkable.filter((t) => t.uses.includes(want)) : walkable;

  return (
    <div className="shell">
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>Trails</h1>
        <p>Forest Service trails around the valley, nearest to Big Bear Lake first.</p>
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
        <Link href="/trails" className={`chip${want ? '' : ' chip-on'}`} aria-current={want ? undefined : 'page'}>
          All
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/trails?for=${f.key}`}
            className={`chip${want === f.key ? ' chip-on' : ''}`}
            aria-current={want === f.key ? 'page' : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {!data.ok && <div className="notice">The trail list is not available right now. Please try again later.</div>}
      {data.ok && shown.length === 0 && <div className="notice">No trails are listed for this use.</div>}

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

      <p className="note">
        Lengths cover the whole trail, which can run beyond the valley. Distance is a straight line from Big Bear
        Lake village to the nearest part of the trail. This list does not show snow, downed trees or closures, so
        check with the Big Bear Discovery Center before a long outing. Trail data: US Forest Service.
      </p>
      <p className="note">
        Looking for 4x4 and dirt bike routes? See <Link href="/off-road">off-road routes</Link>.
      </p>
    </div>
  );
}

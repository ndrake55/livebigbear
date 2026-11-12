import Link from 'next/link';
import { COMMUNITIES, communityBySlug } from '@/lib/communities';
import { APPROACHES } from '@/lib/routes';
import { LABEL, verdict } from '@/lib/status';
import { getWeather, STORM_WEATHER } from '@/lib/weather';
import { loadSnapshot, pacificTime } from '@/lib/view';
import { alertsOn } from '@/lib/alerts-on';
import { InstallLink } from './install-hint';
import { SignupForm } from './signup-form';
import { WeatherSection } from './weather-section';

export const revalidate = 120;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; c?: string }>;
}) {
  const { demo, c } = await searchParams;
  const picked = communityBySlug(c);
  const community = picked ?? COMMUNITIES[0];
  const [snap, weather] = await Promise.all([
    loadSnapshot(demo),
    demo === 'storm' ? Promise.resolve(STORM_WEATHER) : getWeather(community),
  ]);
  const href = (slug?: string) => {
    const params = new URLSearchParams();
    if (slug) params.set('c', slug);
    if (demo === 'storm') params.set('demo', 'storm');
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };
  const v = verdict(
    snap.routes.map((r) => ({ id: r.def.id, name: r.def.name, level: r.level })),
    APPROACHES,
  );
  const q = snap.demo ? '?demo=storm' : '';

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
        <div className="checked">Checked {pacificTime(snap.fetchedAt)}</div>
      </header>

      <nav className="chips" aria-label="Community">
        <Link href={href()} className={`chip${picked ? '' : ' chip-on'}`} aria-current={picked ? undefined : 'page'}>
          Whole valley
        </Link>
        {COMMUNITIES.map((x) => (
          <Link
            key={x.slug}
            href={href(x.slug)}
            className={`chip${picked?.slug === x.slug ? ' chip-on' : ''}`}
            aria-current={picked?.slug === x.slug ? 'page' : undefined}
          >
            {x.name}
          </Link>
        ))}
      </nav>

      {snap.demo && <div className="notice">Sample storm data for preview. Not real conditions.</div>}

      <section className="verdict" aria-label="Summary">
        <div className="eyebrow">Getting up the hill</div>
        <h1>{v.headline}</h1>
        <p>{v.detail}</p>
      </section>

      <section>
        <h2>Roads</h2>
        <div className="list">
          {snap.routes.map((r) => (
            <Link key={r.def.id} href={`/roads/${r.def.id}${q}`} className="row">
              <span className="row-text">
                <span className="row-name">{r.def.name}</span>
                <span className="row-sub">{r.def.sub}</span>
              </span>
              <span className={`tag tag-${r.level}`}>{LABEL[r.level]}</span>
            </Link>
          ))}
        </div>
      </section>

      <WeatherSection weather={weather} place={picked ? picked.name : 'whole valley'} />

      {alertsOn() && (
        <section className="card">
          <h2>Free storm-day emails</h2>
          <p className="note" style={{ marginBottom: 12 }}>
            A morning summary when chains or closures are in effect. Nothing on clear days.
          </p>
          <SignupForm />
        </section>
      )}

      <footer className="foot">
        Road status comes from Caltrans and weather from the National Weather Service. Both can lag conditions on
        the road. Always follow posted signs.
        <div style={{ marginTop: 10 }}>
          <InstallLink />
        </div>
      </footer>
    </div>
  );
}

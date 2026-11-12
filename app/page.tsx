import Link from 'next/link';
import { COMMUNITIES, communityBySlug } from '@/lib/communities';
import { APPROACHES } from '@/lib/routes';
import { LABEL, verdict } from '@/lib/status';
import { getAir } from '@/lib/air';
import { describeFire, getFires, SAMPLE_FIRE } from '@/lib/fires';
import { buildToday } from '@/lib/today';
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
  const [snap, weather, fireData, air] = await Promise.all([
    loadSnapshot(demo),
    demo === 'storm' ? Promise.resolve(STORM_WEATHER) : getWeather(community),
    demo === 'storm' ? Promise.resolve({ ok: true, fires: [SAMPLE_FIRE] }) : getFires(),
    getAir(),
  ]);
  const today = buildToday(snap.routes, weather, new Date(), air);
  const fires = fireData.fires;
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

      {fires.length > 0 && (
        <section className="fire" aria-label="Fire near the valley">
          <div className="eyebrow">Fire near the valley</div>
          {fires.slice(0, 3).map((f) => (
            <div key={f.id} className="fire-item">
              <strong>{f.name}</strong>
              <span>{describeFire(f)}</span>
            </div>
          ))}
          <p className="fire-note">
            From CAL FIRE, and it can lag. For evacuations follow official orders, not this app.{' '}
            <a href={fires[0].url} target="_blank" rel="noopener noreferrer">
              CAL FIRE details
            </a>
          </p>
        </section>
      )}

      <section className="verdict" aria-label="Summary">
        <div className="eyebrow">Getting up the hill</div>
        <h1>{v.headline}</h1>
        <p>{v.detail}</p>
      </section>

      <section>
        <h2>Today in Big Bear</h2>
        <div className="list">
          {today.lines.map((l) => (
            <div key={l.activity} className="row row-static">
              <span className="row-text">
                <span className="row-name">{l.activity}</span>
                <span className="row-sub">{l.detail}</span>
              </span>
              <span className={`tag today-${l.rating}`}>{l.label}</span>
            </div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          {today.daylight}
        </p>
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ROUTES, routeById } from '@/lib/routes';
import { EXPLAIN, HEADLINE, LABEL, parseLevel } from '@/lib/status';
import { loadMapData } from '@/lib/mapdata';
import { loadSnapshot } from '@/lib/view';
import { MapView } from '../../map/map-view';

export const revalidate = 120;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ demo?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const def = routeById((await params).id);
  if (!def) return {};
  return {
    title: `${def.name} road conditions and chain control`,
    description: `Live chain control status for ${def.name}, ${def.sub}, into Big Bear.`,
  };
}

export function generateStaticParams() {
  return ROUTES.map((r) => ({ id: r.id }));
}

export default async function RoutePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { demo } = await searchParams;
  if (!routeById(id)) notFound();
  const snap = await loadSnapshot(demo);
  const r = snap.routes.find((x) => x.def.id === id)!;
  const mapData = await loadMapData(snap, { demo: snap.demo, weather: false });
  const q = snap.demo ? '?demo=storm' : '';

  return (
    <div className="shell">
      <Link href={`/${q}`} className="back">
        <span aria-hidden="true">‹</span> All roads
      </Link>

      <div className="title">
        <h1>{r.def.name}</h1>
        <p>{r.def.sub}</p>
      </div>

      {snap.demo && <div className="notice">Sample storm data for preview. Not real conditions.</div>}

      <section className={`banner banner-${r.level}`}>
        <div className="eyebrow">{LABEL[r.level]}</div>
        <h2>{HEADLINE[r.level]}</h2>
        <p>{EXPLAIN[r.level]}</p>
        {r.since && r.level !== 'unknown' && <div className="since">Reported since {r.since}</div>}
      </section>

      <section>
        <h2>On the map</h2>
        <MapView data={mapData} focus={id} />
      </section>

      {r.points.length > 0 && (
        <section>
          <h2>Chain control points</h2>
          <div className="list">
            {r.points.map((p, i) => {
              const level = parseLevel(p.status, p.description);
              return (
                <div key={i} className="row row-static">
                  <span className="row-text">
                    <span className="row-name">{p.locationName || p.nearbyPlace || 'Unnamed point'}</span>
                    {p.description && <span className="row-sub">{p.description}</span>}
                  </span>
                  <span className={`state state-${level}`}>{LABEL[level]}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer className="foot">
        Road status comes from Caltrans and can lag conditions on the road. Always follow posted signs.
      </footer>
    </div>
  );
}

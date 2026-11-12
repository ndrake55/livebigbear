import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { directionsUrl } from '@/lib/arcgis';
import { COMMUNITIES } from '@/lib/communities';
import { buildToday } from '@/lib/today';
import { getTrails, USE_LABEL } from '@/lib/trails';
import { getWeather } from '@/lib/weather';
import { PlaceMap } from '../../place-map';

export const revalidate = 1800;

type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  const data = await getTrails();
  return { data, trail: data.trails.find((t) => t.slug === slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { trail } = await find(slug);
  if (!trail) return {};
  return {
    title: `${trail.name} trail map and directions, Big Bear`,
    description: `${trail.name}${trail.miles !== null ? `, ${trail.miles} miles` : ''}: trail map, directions to the start and today’s trail weather near Big Bear Lake.`,
    alternates: { canonical: `/trails/${trail.slug}` },
  };
}

export default async function TrailPage({ params }: Props) {
  const { slug } = await params;
  const [{ data, trail }, weather] = await Promise.all([find(slug), getWeather(COMMUNITIES[0])]);
  if (!trail) {
    if (data.ok) notFound();
    return (
      <div className="shell">
        <Link href="/trails" className="back">
          <span aria-hidden="true">‹</span> Trails
        </Link>
        <div className="notice">Trail details are not available right now. Please try again later.</div>
      </div>
    );
  }
  const outlook = buildToday([], weather, new Date()).lines.find((l) => l.activity === 'Trails');
  const uses = trail.uses.filter((u) => u !== 'moto').map((u) => USE_LABEL[u]);
  const pins = trail.start ? [{ ...trail.start, label: 'Start of the trail nearest Big Bear Lake', text: 'Start' }] : [];

  return (
    <div className="shell">
      <Link href="/trails" className="back">
        <span aria-hidden="true">‹</span> Trails
      </Link>
      <div className="title">
        <h1>{trail.name}</h1>
        <p>{trail.number ? `Forest Service trail ${trail.number}` : 'Forest Service trail'}</p>
      </div>

      <div className="facts">
        {trail.miles !== null && <span className="fact">{trail.miles} mi long</span>}
        {trail.fromLake !== null && <span className="fact">{trail.fromLake} mi from Big Bear Lake</span>}
        {uses.map((u) => (
          <span key={u} className="fact">
            {u}
          </span>
        ))}
      </div>

      {trail.paths.length > 0 && <PlaceMap lines={trail.paths} pins={pins} label={`Map of ${trail.name}`} />}

      {trail.start && (
        <a className="btn" href={directionsUrl(trail.start)} target="_blank" rel="noopener noreferrer">
          Directions to the start
        </a>
      )}

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

      <p className="note">
        Directions open in your map app and go to the end of the trail nearest Big Bear Lake village. That is
        usually, but not always, where the parking is, so check the map before you set off. The length covers the
        whole trail. This page does not show snow, downed trees or closures. Trail data: US Forest Service.
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { directionsUrl } from '@/lib/arcgis';
import { getOffRoad } from '@/lib/offroad';
import { PlaceMap } from '../../place-map';

export const revalidate = 1800;

type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  const data = await getOffRoad();
  return { data, route: data.routes.find((r) => r.slug === slug) };
}

const titleOf = (r: { number: string; name: string }) => [r.number, r.name].filter(Boolean).join(' ');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { route } = await find(slug);
  if (!route) return {};
  return {
    title: `${titleOf(route)} off-road route map and season, Big Bear`,
    description: `${titleOf(route)}${route.miles !== null ? `, ${route.miles} miles` : ''}: route map, directions, which vehicles are allowed and the open season, near Big Bear Lake.`,
    alternates: { canonical: `/off-road/${route.slug}` },
  };
}

export default async function OffRoadRoutePage({ params }: Props) {
  const { slug } = await params;
  const { data, route } = await find(slug);
  if (!route) {
    if (data.ok) notFound();
    return (
      <div className="shell">
        <Link href="/off-road" className="back">
          <span aria-hidden="true">‹</span> Off-road routes
        </Link>
        <div className="notice">Route details are not available right now. Please try again later.</div>
      </div>
    );
  }
  const pins = route.start ? [{ ...route.start, label: 'End of the route nearest Big Bear Lake', text: 'Start' }] : [];

  return (
    <div className="shell">
      <Link href="/off-road" className="back">
        <span aria-hidden="true">‹</span> Off-road routes
      </Link>
      <div className="title">
        <h1>{titleOf(route)}</h1>
        <p>{route.kind === 'road' ? 'Forest road' : 'Forest Service off-road trail'}</p>
      </div>

      <div className="facts">
        {route.miles !== null && <span className="fact">{route.miles} mi long</span>}
        {route.vehicles.map((v) => (
          <span key={v} className="fact">
            {v}
          </span>
        ))}
      </div>

      {(route.seasonLabel || route.openNow !== null) && (
        <div className="list">
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Season</span>
              <span className="row-sub">{route.seasonLabel ? `Open ${route.seasonLabel}` : 'No dates published'}</span>
            </span>
            {route.openNow !== null && (
              <span className={`tag ${route.openNow ? 'today-good' : 'today-poor'}`}>{route.openNow ? 'In season' : 'Out of season'}</span>
            )}
          </div>
        </div>
      )}

      {route.paths.length > 0 && <PlaceMap lines={route.paths} pins={pins} label={`Map of ${titleOf(route)}`} />}

      {route.start && (
        <a className="btn" href={directionsUrl(route.start)} target="_blank" rel="noopener noreferrer">
          Directions to the start
        </a>
      )}

      <p className="note">
        Directions open in your map app and go to the end of the route nearest Big Bear Lake village. A route that
        is in season can still be closed by snow, mud, fire or a forest order, so check with the Big Bear Discovery
        Center before you go. Route data: US Forest Service motor vehicle use map.
      </p>
    </div>
  );
}

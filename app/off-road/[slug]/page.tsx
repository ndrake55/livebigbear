import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { directionsUrl } from '@/lib/arcgis';
import { getOffRoad } from '@/lib/offroad';
import { hasDb } from '@/lib/db';
import { ratingFor } from '@/lib/ratings';
import { crumbs, jsonLd, placeLd } from '@/lib/site';
import { PlaceMap } from '../../place-map';
import { RateStars } from '../../rate-stars';

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
  const rating = hasDb() ? await ratingFor(`offroad:${route.slug}`).catch(() => null) : null;
  const about = [
    `${titleOf(route)} is a ${route.miles !== null ? `${route.miles}-mile ` : ''}${route.kind === 'road' ? 'forest road' : 'off-road trail'} near Big Bear Lake, California`,
    route.vehicles.length ? `Open to ${route.vehicles.join(', ').toLowerCase()}` : '',
    route.seasonLabel ? `Season: ${route.seasonLabel}` : '',
  ]
    .filter(Boolean)
    .join('. ');
  const start = route.start;
  const pins = start
    ? [{ lat: start.lat, lon: start.lon, label: start.kind === 'guess' ? 'Nearest end of the route' : 'Trailhead', text: 'Start' }]
    : [];

  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(placeLd({ name: titleOf(route), description: `${about}.`, path: `/off-road/${route.slug}`, at: route.start, rating }))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(crumbs([{ name: 'Explore', path: '/explore' }, { name: 'Off-road routes', path: '/off-road' }, { name: titleOf(route), path: `/off-road/${route.slug}` }]))}
      />
      <Link href="/off-road" className="back">
        <span aria-hidden="true">‹</span> Off-road routes
      </Link>
      <div className="title">
        <h1>{titleOf(route)}</h1>
        <p>{route.kind === 'road' ? 'Forest road' : 'Forest Service off-road trail'}</p>
      </div>

      <p className="lede">{about}.</p>

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

      {start?.notice && <div className="notice">{start.notice}</div>}

      {start && (
        <>
          <a className="btn" href={directionsUrl(start)} target="_blank" rel="noopener noreferrer">
            {start.kind === 'guess' ? 'Directions to the nearest end' : 'Directions to the trailhead'}
          </a>
          <p className="note" style={{ marginTop: -8 }}>
            {start.kind === 'checked' && `Trailhead: ${start.where}.`}
            {start.kind === 'listed' && 'Starting point from the Forest Service recreation site list.'}
            {start.kind === 'guess' &&
              'No trailhead is on file for this one yet, so directions go to the end nearest Big Bear Lake village. Check the map before you set off.'}
          </p>
        </>
      )}

      <RateStars item={`offroad:${route.slug}`} what="route" />

      <p className="note">
        Directions open in your map app. A route that
        is in season can still be closed by snow, mud, fire or a forest order, so check with the Big Bear Discovery
        Center before you go. Route data: US Forest Service motor vehicle use map.
      </p>
    </div>
  );
}

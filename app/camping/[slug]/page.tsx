import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { directionsUrl } from '@/lib/arcgis';
import { getCampgrounds } from '@/lib/camping';
import { hasDb } from '@/lib/db';
import { ratingFor } from '@/lib/ratings';
import { crumbs, jsonLd, placeLd, SITE } from '@/lib/site';
import { PlaceMap } from '../../place-map';
import { RateStars } from '../../rate-stars';

export const revalidate = 1800;

type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  const data = await getCampgrounds();
  return { data, camp: data.campgrounds.find((c) => c.slug === slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { camp } = await find((await params).slug);
  if (!camp) return {};
  return {
    title: `${camp.name} campground near Big Bear: tonight’s low, map and directions`,
    description: `${camp.name}, ${camp.miles} miles from Big Bear Lake: tonight’s forecast low, a map, directions and visitor ratings.`,
    alternates: { canonical: `/camping/${camp.slug}` },
  };
}

export default async function CampgroundPage({ params }: Props) {
  const { slug } = await params;
  const { data, camp } = await find(slug);
  if (!camp) {
    if (data.ok) notFound();
    return (
      <div className="shell">
        <Link href="/camping" className="back">
          <span aria-hidden="true">‹</span> Camping
        </Link>
        <div className="notice">Campground details are not available right now. Please try again later.</div>
      </div>
    );
  }
  const rating = hasDb() ? await ratingFor(`camp:${camp.slug}`).catch(() => null) : null;
  const about = `${camp.name} is a ${camp.kind.toLowerCase()} in the San Bernardino National Forest, ${camp.miles} miles from Big Bear Lake, California. ${
    camp.reservable ? 'It takes reservations through Recreation.gov.' : 'Check Recreation.gov for how to book.'
  }`;
  const ld = { ...placeLd({ name: camp.name, description: about, path: `/camping/${camp.slug}`, at: camp, rating }), '@type': 'Campground', url: `${SITE}/camping/${camp.slug}` };

  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(crumbs([{ name: 'Explore', path: '/explore' }, { name: 'Camping', path: '/camping' }, { name: camp.name, path: `/camping/${camp.slug}` }]))}
      />
      <Link href="/camping" className="back">
        <span aria-hidden="true">‹</span> Camping
      </Link>
      <div className="title">
        <h1>{camp.name}</h1>
        <p>{camp.kind}</p>
      </div>

      <p className="lede">{about}</p>

      <div className="facts">
        <span className="fact">{camp.miles} mi from Big Bear Lake</span>
        <span className="fact">{camp.reservable ? 'Takes reservations' : 'Check how to book'}</span>
      </div>

      {camp.tonight && (
        <div className="list">
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">{camp.tonight.name}</span>
              <span className="row-sub">{camp.tonight.short}</span>
            </span>
            <span className="temp">Low {camp.tonight.low}°</span>
          </div>
        </div>
      )}

      <PlaceMap pins={[{ lat: camp.lat, lon: camp.lon, label: camp.name, text: 'Camp' }]} label={`Map showing ${camp.name}`} />

      <a className="btn" href={directionsUrl(camp)} target="_blank" rel="noopener noreferrer">
        Directions to the campground
      </a>
      <a className="btn btn-quiet" href={camp.url} target="_blank" rel="noopener noreferrer">
        Check dates on Recreation.gov
      </a>

      <RateStars item={`camp:${camp.slug}`} what="campground" />

      <p className="note">
        This page does not show whether the campground is open for the season or has sites free; Recreation.gov
        does. Many Big Bear campgrounds close for winter. Campground data: Recreation.gov. Forecast: National
        Weather Service.
      </p>
    </div>
  );
}

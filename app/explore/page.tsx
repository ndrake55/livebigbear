import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  alternates: { canonical: '/explore' },
  title: 'Explore Big Bear: live conditions for getting outside',
  description: 'Live conditions for trails, off-road routes, the lake, camping, roads and weather around the Big Bear Valley.',
};

const ITEMS: { href: string; name: string; sub: string }[] = [
  { href: '/trails', name: 'Trails', sub: 'Hiking, biking and horse trails, with today’s trail weather' },
  { href: '/off-road', name: 'Off-road routes', sub: '4x4, ATV and dirt bike routes, and which are in season' },
  { href: '/lake', name: 'The lake', sub: 'Water temperature, lake level and which launch ramps are open' },
  { href: '/camping', name: 'Camping', sub: 'Nearby campgrounds with tonight’s low at each one' },
  { href: '/cameras', name: 'Live cameras', sub: 'Webcams for the roads, the ski resorts, the village and the eagle nest' },
  { href: '/map', name: 'Map and cameras', sub: 'Road status, live cameras, weather and any fires nearby' },
  { href: '/', name: 'Today in Big Bear', sub: 'Roads, trails, the lake, air quality and daylight at a glance' },
];

export default function ExplorePage() {
  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
      </header>
      <div className="title">
        <h1>Explore</h1>
        <p>What it is like out there right now.</p>
      </div>
      <div className="list">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="row">
            <span className="row-text">
              <span className="row-name">{i.name}</span>
              <span className="row-sub">{i.sub}</span>
            </span>
            <span className="temp" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>
      <p className="note">
        <Link href="/about">About Live Big Bear</Link>: who runs it and where the data comes from.
      </p>
    </div>
  );
}

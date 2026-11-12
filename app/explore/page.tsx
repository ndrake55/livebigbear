import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Explore Big Bear: live conditions for getting outside',
  description: 'Live conditions for camping, the roads, cameras and weather around the Big Bear Valley.',
};

const ITEMS: { href: string; name: string; sub: string }[] = [
  { href: '/camping', name: 'Camping', sub: 'Nearby campgrounds with tonight’s low at each one' },
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
      <p className="note">Trails, the lake and fishing are being added next.</p>
    </div>
  );
}

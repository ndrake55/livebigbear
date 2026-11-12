import type { Metadata } from 'next';
import Link from 'next/link';
import { jsonLd, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About Live Big Bear: who runs it and where the data comes from',
  description:
    'Live Big Bear is a free, independent app showing live road, weather and outdoor conditions for the Big Bear Valley. Here is where every number comes from and how often it is checked.',
  alternates: { canonical: '/about' },
};

const SOURCES: { what: string; from: string; how: string }[] = [
  { what: 'Road status and chain control', from: 'Caltrans', how: 'Checked every couple of minutes' },
  { what: 'Highway cameras', from: 'Caltrans', how: 'Checked every few minutes' },
  { what: 'Weather, snow forecast and alerts', from: 'National Weather Service', how: 'Checked several times an hour' },
  { what: 'Current conditions', from: 'Big Bear Airport weather station', how: 'Latest reading, usually under an hour old' },
  { what: 'Fires', from: 'CAL FIRE', how: 'Checked every few minutes' },
  { what: 'Air quality', from: 'AirNow, US Environmental Protection Agency', how: 'Checked twice an hour' },
  { what: 'Trails and off-road routes', from: 'US Forest Service, San Bernardino National Forest', how: 'Checked a few times a day' },
  { what: 'Lake temperature, level and launch ramps', from: 'Big Bear Municipal Water District', how: 'Checked hourly' },
  { what: 'Campgrounds', from: 'Recreation.gov', how: 'Checked a few times a day' },
  { what: 'Maps', from: 'OpenStreetMap contributors, drawn by OpenFreeMap', how: '' },
];

const org = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Live Big Bear',
  url: `${SITE}/`,
  logo: `${SITE}/icons/icon-512.png`,
  description: 'A free, independent app showing live road, weather and outdoor conditions for the Big Bear Valley, California.',
  areaServed: 'Big Bear Valley, California',
};

export default function AboutPage() {
  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(org)} />
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>About Live Big Bear</h1>
        <p>One place to check before you drive up or head outside.</p>
      </div>

      <section>
        <p className="lede">
          Live Big Bear shows what is happening in the Big Bear Valley right now: which roads are open, where chains
          are required, the weather in each community, live cameras, trails, off-road routes, the lake and
          campgrounds. It covers Big Bear Lake, Big Bear City, Sugarloaf, Fawnskin and Baldwin Lake. It is free and
          needs no account.
        </p>
      </section>

      <section>
        <h2>Who runs it</h2>
        <p className="lede">
          Live Big Bear is an independent community app. It is not run by Caltrans, the Forest Service, the City of
          Big Bear Lake or any other agency. It gathers what those agencies publish and puts it on one screen that
          is quick to read on a phone.
        </p>
      </section>

      <section>
        <h2>Where the data comes from</h2>
        <div className="list">
          {SOURCES.map((s) => (
            <div key={s.what} className="row row-static">
              <span className="row-text">
                <span className="row-name">{s.what}</span>
                <span className="row-sub">{s.from}</span>
                {s.how && <span className="row-sub">{s.how}</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>What to keep in mind</h2>
        <p className="lede">
          Every source can lag behind what is happening on the ground. Follow posted signs on the road. For
          evacuations and closures, the agency in charge has the final word, not this app. Trail, bike and horse
          labels, difficulty and trailheads were checked by hand against Forest Service and Big Bear visitor
          information; star ratings come only from visitors.
        </p>
      </section>

      <p className="note">
        Start with the <Link href="/">roads</Link>, the <Link href="/map">live map</Link> or{' '}
        <Link href="/explore">Explore</Link>.
      </p>
    </div>
  );
}

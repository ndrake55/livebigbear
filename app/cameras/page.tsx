import type { Metadata } from 'next';
import Link from 'next/link';
import { getCameras, type Camera } from '@/lib/cameras';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Big Bear webcams: live cameras for the roads, ski resorts and village',
  description:
    'Live Big Bear webcams in one place: Caltrans highway cameras, Snow Summit, Bear Mountain and Snow Valley, Big Bear Boulevard, the airport and the bald eagle nest.',
  alternates: { canonical: '/cameras' },
};

const GROUPS: { key: Camera['group']; blurb: string }[] = [
  { key: 'Getting there', blurb: 'What the roads look like right now.' },
  { key: 'On the mountain', blurb: 'Snow and crowds at the ski resorts.' },
  { key: 'Around the valley', blurb: 'The airport and the famous bald eagle nest.' },
];

function View({ c }: { c: Camera }) {
  if (c.kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="panel-media" src={c.src} alt={`Live camera view: ${c.name}`} loading="lazy" />;
  }
  if (c.kind === 'youtube') {
    return (
      <iframe
        className="panel-media cam-frame"
        src={`https://www.youtube-nocookie.com/embed/${c.src}?rel=0`}
        title={`Live camera: ${c.name}`}
        loading="lazy"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }
  return (
    <a className="btn btn-quiet" href={c.src} target="_blank" rel="noopener noreferrer">
      Open the {c.name} camera
    </a>
  );
}

export default async function CamerasPage() {
  const data = await getCameras();

  return (
    <div className="shell">
      <Link href="/explore" className="back">
        <span aria-hidden="true">‹</span> Explore
      </Link>
      <div className="title">
        <h1>Live cameras</h1>
        <p>Big Bear webcams in one place.</p>
      </div>

      {!data.ok && <div className="notice">The Caltrans highway cameras are not available right now. The others still work.</div>}

      {GROUPS.map((g) => {
        const cams = data.cameras.filter((c) => c.group === g.key);
        if (cams.length === 0) return null;
        return (
          <section key={g.key}>
            <h2>{g.key}</h2>
            <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
              {g.blurb}
            </p>
            <div className="cams">
              {cams.map((c) => (
                <div key={c.id} className="card cam">
                  <h3>{c.name}</h3>
                  <View c={c} />
                  <p className="note">
                    {c.kind === 'link' ? `This camera is shown on the ${c.credit} site.` : `Camera: ${c.credit}.`}
                    {c.lat === null && ' Its location is kept private to protect the birds.'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <p className="note">
        Cameras belong to their owners and can go offline without notice. See where each one is on the{' '}
        <Link href="/map">live map</Link>.
      </p>
    </div>
  );
}

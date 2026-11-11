import Link from 'next/link';
import { QUICKMAP_URL } from '@/lib/caltrans';
import { LABEL, verdict } from '@/lib/status';
import { loadSnapshot, pacificTime } from '@/lib/view';

export const revalidate = 120;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  const snap = await loadSnapshot(demo);
  const v = verdict(snap.routes.map((r) => ({ name: r.def.name, via: r.def.via, level: r.level })));
  const q = snap.demo ? '?demo=storm' : '';

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
        <div className="checked">Checked {pacificTime(snap.fetchedAt)}</div>
      </header>

      {snap.demo && <div className="notice">Sample storm data for preview. Not real conditions.</div>}

      <section className="verdict" aria-label="Summary">
        <div className="eyebrow">Getting up the hill</div>
        <h1>{v.headline}</h1>
        <p>{v.detail}</p>
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

      <a className="button" href={QUICKMAP_URL} target="_blank" rel="noopener noreferrer">
        See the roads on Caltrans QuickMap
      </a>

      <footer className="foot">
        Road status comes from Caltrans and can lag conditions on the road. Always follow posted signs.
      </footer>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { summarize } from '@/lib/caltrans';
import { STORM_SAMPLE } from '@/lib/sample';
import { stormMail } from '@/lib/storm-mail';
import { STORM_WEATHER } from '@/lib/weather';

export const metadata: Metadata = { title: 'Sample storm-day email', robots: { index: false } };

/** Shows what a storm-day email looks like, using made-up storm data. */
export default function SampleEmailPage() {
  const mail = stormMail('you@example.com', 'morning', summarize([...STORM_SAMPLE]), STORM_WEATHER, new Date(), '#', '#');
  return (
    <div className="shell">
      <Link href="/alerts" className="back">
        <span aria-hidden="true">‹</span> Alerts
      </Link>
      <div className="title">
        <h1>Sample storm-day email</h1>
        <p>Made-up storm data, to show what arrives on a morning with chains or closures.</p>
      </div>
      <div className="list">
        <div className="row row-static">
          <span className="row-text">
            <span className="row-sub">Subject</span>
            <span className="row-name">{mail.subject}</span>
          </span>
        </div>
      </div>
      <iframe title="Sample email" srcDoc={mail.html} sandbox="" style={{ width: '100%', height: 760, border: 0, borderRadius: 16, background: '#F2F5F8' }} />
    </div>
  );
}

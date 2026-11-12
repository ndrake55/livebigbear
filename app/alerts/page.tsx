import type { Metadata } from 'next';
import Link from 'next/link';
import { alertsOn } from '@/lib/alerts-on';
import { SignupForm } from '../signup-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/alerts' },
  title: 'Free Big Bear storm-day emails',
  description:
    'Free email on storm days with chain control, road closures and weather for the Big Bear Valley.',
};

export default function AlertsPage() {
  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand">
          Live Big Bear
        </Link>
      </header>

      <div className="title">
        <h1>Storm-day emails</h1>
        <p>Free. A morning summary when chains or closures are in effect, and word of major closures.</p>
      </div>

      {alertsOn() ? (
        <section className="card">
          <SignupForm />
          <p className="note">
            We email a link to confirm it is really you. No spam, and every email has a one-tap unsubscribe.
          </p>
        </section>
      ) : (
        <div className="notice">Email signup is coming soon.</div>
      )}

      <section>
        <h2>What you get</h2>
        <div className="list">
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Storm mornings</span>
              <span className="row-sub">Which roads need chains, which are closed, and the day’s weather.</span>
            </span>
          </div>
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Major closures</span>
              <span className="row-sub">When a road into the valley closes.</span>
            </span>
          </div>
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Quiet otherwise</span>
              <span className="row-sub">Nothing on clear days.</span>
            </span>
          </div>
        </div>
      </section>
      <p className="note">
        <Link href="/alerts/sample">See a sample storm-day email</Link>.
      </p>
    </div>
  );
}
